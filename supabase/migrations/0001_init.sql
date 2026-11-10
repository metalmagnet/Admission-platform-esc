-- Visa platform, first slice. Students never touch the database directly:
-- the upload portal runs on the service role after validating a link token.

create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  role text not null default 'agent' check (role in ('admin', 'agent')),
  created_at timestamptz not null default now()
);

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

create table templates (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  visa_type text not null,
  version text not null,
  issued_on date not null,
  source text not null,
  general_notes jsonb not null default '[]',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country, visa_type, version)
);

create table template_requirements (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates on delete cascade,
  code text not null,
  sort int not null,
  kind text not null check (kind in ('document', 'step')),
  provider text not null check (provider in ('student', 'agent')),
  title jsonb not null,
  help jsonb not null,
  mandatory boolean not null,
  physical_default boolean not null,
  conditions jsonb not null default '[]',
  review_points jsonb not null default '[]',
  pdf_ref text not null,
  unique (template_id, code)
);

create table applicants (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates,
  agent_id uuid not null references profiles,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  nationality text,
  email text not null,
  phone text,
  language text not null default 'en' check (language in ('en', 'fr')),
  parent_name text,
  parent_email text,
  parent_phone text,
  passport_number text,
  passport_expiry date,
  institution text,
  course_name text,
  mqf_level int check (mqf_level between 1 and 8),
  course_start date,
  course_months int check (course_months > 0),
  course_type text check (course_type in ('full_time', 'part_time')),
  funding text check (funding in ('self', 'sponsored')),
  accommodation text check (accommodation in ('school', 'lease', 'host', 'hotel')),
  host_secondary_address boolean not null default false,
  vfs_date date,
  vfs_fee_type text check (vfs_fee_type in ('standard', 'extended')),
  stage text not null default 'collecting'
    check (stage in ('collecting', 'ready', 'submitted', 'approved', 'rejected', 'action_required')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applicants_agent_idx on applicants (agent_id);
create index applicants_passport_idx on applicants (lower(passport_number));
create index applicants_identity_idx on applicants (lower(last_name), lower(first_name), date_of_birth);

create table applicant_requirements (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants on delete cascade,
  requirement_id uuid not null references template_requirements,
  status text not null default 'missing' check (status in ('missing', 'pending', 'approved', 'rejected')),
  rejection_reason text,
  physical_required boolean not null default false,
  physical_received boolean not null default false,
  checked_points jsonb not null default '[]',
  reviewed_by uuid references profiles,
  reviewed_at timestamptz,
  unique (applicant_id, requirement_id)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  applicant_requirement_id uuid not null references applicant_requirements on delete cascade,
  version int not null,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes int not null,
  sha256 text not null,
  uploaded_by_agent uuid references profiles,
  uploaded_at timestamptz not null default now(),
  is_current boolean not null default true,
  unique (applicant_requirement_id, version)
);
create unique index documents_one_current on documents (applicant_requirement_id) where is_current;
create index documents_hash_idx on documents (sha256);

create table upload_links (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references profiles,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz
);

create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null,
  applicant_id uuid references applicants on delete set null,
  action text not null,
  details jsonb not null default '{}'
);
create index audit_applicant_idx on audit_log (applicant_id, at desc);

create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger applicants_touch before update on applicants
  for each row execute function touch_updated_at();

-- Atomic version bump: only the service role may call it.
create function add_document(
  p_applicant_requirement_id uuid, p_storage_path text, p_original_name text,
  p_mime_type text, p_size_bytes int, p_sha256 text, p_agent uuid
) returns documents
language plpgsql security definer set search_path = public as $$
declare
  next_version int;
  doc documents;
begin
  select coalesce(max(version), 0) + 1 into next_version
    from documents where applicant_requirement_id = p_applicant_requirement_id;
  update documents set is_current = false
    where applicant_requirement_id = p_applicant_requirement_id and is_current;
  insert into documents (applicant_requirement_id, version, storage_path, original_name,
                         mime_type, size_bytes, sha256, uploaded_by_agent)
    values (p_applicant_requirement_id, next_version, p_storage_path, p_original_name,
            p_mime_type, p_size_bytes, p_sha256, p_agent)
    returning * into doc;
  update applicant_requirements
    set status = 'pending', rejection_reason = null, reviewed_by = null, reviewed_at = null,
        checked_points = '[]'
    where id = p_applicant_requirement_id;
  return doc;
end $$;
revoke all on function add_document from public, anon, authenticated;
grant execute on function add_document to service_role;

alter table profiles enable row level security;
alter table templates enable row level security;
alter table template_requirements enable row level security;
alter table applicants enable row level security;
alter table applicant_requirements enable row level security;
alter table documents enable row level security;
alter table upload_links enable row level security;
alter table audit_log enable row level security;

create function can_access_applicant(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (select 1 from applicants where id = a and agent_id = auth.uid())
$$;

create policy profiles_read on profiles for select to authenticated using (true);
create policy profiles_admin_write on profiles for update to authenticated
  using (is_admin()) with check (is_admin());

create policy templates_read on templates for select to authenticated using (true);
create policy templates_admin on templates for all to authenticated
  using (is_admin()) with check (is_admin());
create policy requirements_read on template_requirements for select to authenticated using (true);
create policy requirements_admin on template_requirements for all to authenticated
  using (is_admin()) with check (is_admin());

create policy applicants_read on applicants for select to authenticated
  using (is_admin() or agent_id = auth.uid());
create policy applicants_insert on applicants for insert to authenticated
  with check (is_admin() or agent_id = auth.uid());
create policy applicants_update on applicants for update to authenticated
  using (is_admin() or agent_id = auth.uid())
  with check (is_admin() or agent_id = auth.uid());
create policy applicants_delete on applicants for delete to authenticated using (is_admin());

create policy app_req_read on applicant_requirements for select to authenticated
  using (can_access_applicant(applicant_id));
create policy app_req_write on applicant_requirements for all to authenticated
  using (can_access_applicant(applicant_id)) with check (can_access_applicant(applicant_id));

create policy documents_read on documents for select to authenticated
  using (exists (select 1 from applicant_requirements r
                 where r.id = applicant_requirement_id and can_access_applicant(r.applicant_id)));

create policy links_read on upload_links for select to authenticated
  using (can_access_applicant(applicant_id));

create policy audit_read on audit_log for select to authenticated
  using (applicant_id is not null and can_access_applicant(applicant_id) or is_admin());

insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
  on conflict (id) do nothing;

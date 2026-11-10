import { supabaseAdmin } from './supabase/admin';

export async function audit(actor: string, action: string, applicantId: string | null, details: object = {}) {
  const { error } = await supabaseAdmin()
    .from('audit_log')
    .insert({ actor, action, applicant_id: applicantId, details });
  if (error) throw new Error(`Audit write failed: ${error.message}`);
}

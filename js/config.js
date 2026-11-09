/* Backend connection for the public site and the admin. The anon/publishable key is public by design:
   row-level security and the SECURITY DEFINER RPCs in supabase/migrations decide what it can do.
   While url is empty, analytics stays off and the Business Review form shows its failed state. */
window.EXPERIUS_BACKEND = {
  url: 'https://wbazifkgvimwgzaoqhxl.supabase.co',
  anonKey: 'sb_publishable_P31Rk5NQaq3jigPDjeExuw_OghcmTM6'
};

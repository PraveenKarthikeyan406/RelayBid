create or replace function public.hook_restrict_signup_by_email_domain(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
  email_domain text;
begin
  email_domain := split_part(email, '@', 2);

  if email_domain = 'kongu.edu' then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Only @kongu.edu email addresses can sign up.'
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_restrict_signup_by_email_domain(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_by_email_domain(jsonb) from public, anon, authenticated;

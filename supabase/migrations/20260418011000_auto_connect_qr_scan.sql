create or replace function public.register_qr_scan(
  p_scanned_user_id uuid,
  p_scanned_token text,
  p_scanned_expires_at timestamp with time zone
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_1 uuid;
  v_user_2 uuid;
  v_handshake public.connection_handshakes%rowtype;
  v_connection_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_scanned_user_id = v_user_id then
    raise exception 'Cannot scan your own QR code';
  end if;

  if p_scanned_expires_at < timezone('utc'::text, now()) then
    raise exception 'QR payload expired';
  end if;

  if not exists (
    select 1
    from public.qr_tokens t
    where t.user_id = p_scanned_user_id
      and t.token = p_scanned_token
      and t.expires_at >= timezone('utc'::text, now())
  ) then
    raise exception 'Invalid QR payload';
  end if;

  v_user_1 := least(v_user_id, p_scanned_user_id);
  v_user_2 := greatest(v_user_id, p_scanned_user_id);

  insert into public.connection_handshakes (
    user_1_id,
    user_2_id,
    expires_at,
    status
  )
  values (
    v_user_1,
    v_user_2,
    timezone('utc'::text, now()) + interval '2 minute',
    'pending'::public.handshake_status
  )
  on conflict (user_1_id, user_2_id)
  do update set
    updated_at = timezone('utc'::text, now())
  returning * into v_handshake;

  if v_handshake.expires_at < timezone('utc'::text, now())
    or v_handshake.status in ('expired', 'failed', 'connected') then
    update public.connection_handshakes
    set scan_1_at = null,
        scan_2_at = null,
        confirm_1_at = null,
        confirm_2_at = null,
        expires_at = timezone('utc'::text, now()) + interval '2 minute',
        status = 'pending'::public.handshake_status,
        updated_at = timezone('utc'::text, now())
    where id = v_handshake.id
    returning * into v_handshake;
  end if;

  if v_user_id = v_handshake.user_1_id then
    update public.connection_handshakes
    set scan_1_at = coalesce(scan_1_at, timezone('utc'::text, now())),
        updated_at = timezone('utc'::text, now())
    where id = v_handshake.id
    returning * into v_handshake;
  else
    update public.connection_handshakes
    set scan_2_at = coalesce(scan_2_at, timezone('utc'::text, now())),
        updated_at = timezone('utc'::text, now())
    where id = v_handshake.id
    returning * into v_handshake;
  end if;

  if v_handshake.scan_1_at is not null and v_handshake.scan_2_at is not null then
    insert into public.connections (user_1_id, user_2_id, status)
    values (v_handshake.user_1_id, v_handshake.user_2_id, 'active'::public.connection_status)
    on conflict (user_1_id, user_2_id)
    do update set
      status = 'active'::public.connection_status,
      updated_at = timezone('utc'::text, now())
    returning id into v_connection_id;

    update public.connection_handshakes
    set status = 'connected'::public.handshake_status,
        updated_at = timezone('utc'::text, now())
    where id = v_handshake.id
    returning * into v_handshake;
  end if;

  return jsonb_build_object(
    'handshake_id', v_handshake.id,
    'status', v_handshake.status,
    'connection_id', v_connection_id,
    'scan_1_at', v_handshake.scan_1_at,
    'scan_2_at', v_handshake.scan_2_at,
    'confirm_1_at', v_handshake.confirm_1_at,
    'confirm_2_at', v_handshake.confirm_2_at
  );
end;
$$;

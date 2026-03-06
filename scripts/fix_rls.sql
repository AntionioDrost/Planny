-- Fix: Allow users to view profiles of their connections
CREATE POLICY "Users can view their connections' profiles."
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.connections c
      WHERE (c.user_1_id = auth.uid() AND c.user_2_id = users.id)
         OR (c.user_2_id = auth.uid() AND c.user_1_id = users.id)
    )
  );

-- Fix: Allow users to insert connections
CREATE POLICY "Users can create connections."
  ON public.connections FOR INSERT
  WITH CHECK ( auth.uid() = user_1_id OR auth.uid() = user_2_id );

-- Fix: Allow users to update their own connections
CREATE POLICY "Users can update their connections."
  ON public.connections FOR UPDATE
  USING ( auth.uid() = user_1_id OR auth.uid() = user_2_id );

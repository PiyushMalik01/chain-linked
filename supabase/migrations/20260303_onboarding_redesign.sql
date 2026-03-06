-- Feature 5: Onboarding redesign (org vs member paths) and content rules

-- Add onboarding type to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_type TEXT DEFAULT 'owner';

-- Add discoverable flag to teams (opt-in for search)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS discoverable BOOLEAN DEFAULT false;

-- Join requests table
CREATE TABLE IF NOT EXISTS team_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, team_id)
);

ALTER TABLE team_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own join requests"
  ON team_join_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own join requests"
  ON team_join_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Team admins can view team join requests"
  ON team_join_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_join_requests.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Team admins can update team join requests"
  ON team_join_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_join_requests.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('admin', 'owner')
    )
  );

-- Content rules table (Global Hard Rules for AI)
CREATE TABLE IF NOT EXISTS content_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own personal content rules"
  ON content_rules FOR ALL
  USING (auth.uid() = user_id AND team_id IS NULL);

CREATE POLICY "Team members can read team rules"
  ON content_rules FOR SELECT
  USING (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = content_rules.team_id
        AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can manage team rules"
  ON content_rules FOR ALL
  USING (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = content_rules.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('admin', 'owner')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_rules_user ON content_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_content_rules_team ON content_rules(team_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_team ON team_join_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON team_join_requests(user_id);

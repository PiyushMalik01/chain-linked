-- Feature 2: Influencer following/unfollowing
CREATE TABLE IF NOT EXISTS followed_influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_url TEXT NOT NULL,
  linkedin_username TEXT,
  author_name TEXT,
  author_headline TEXT,
  author_profile_picture TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_scraped_at TIMESTAMPTZ,
  posts_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, linkedin_url)
);

ALTER TABLE followed_influencers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own followed influencers"
  ON followed_influencers FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_followed_influencers_user ON followed_influencers(user_id);

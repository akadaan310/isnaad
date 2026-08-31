-- ===========================================================================
--  مرصد الإسناد — relational schema
--
--  Supabase is optional for this studio. With no credentials the app runs
--  entirely from the mined corpus in /data and keeps تدبّر notes in the
--  browser. This schema exists for when you want the corpus and your notes in
--  Postgres instead: queryable, joinable, and shareable across devices.
--
--  Apply with:
--      supabase db push
--  or paste into the SQL editor. Then:
--      npm run ingest -- --push-supabase
--
--  A note on what is stored where. `surahs` and `ayaat` are pushed by the
--  ingest script. `words` and `isnad_attributions` are defined here in full,
--  because the word level is where the isnād actually lives and you may well
--  want to query it — but the ingest script does not push them by default:
--  that is 77,429 words and ~180,000 attribution rows, and the app rebuilds
--  them from the morphology in ~80ms anyway. Load them when you want SQL over
--  the isnād, not because the app needs them.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ── السور ──────────────────────────────────────────────────────────────────
create table if not exists public.surahs (
  id                smallint primary key check (id between 1 and 114),
  name              text    not null,
  transliteration   text    not null,
  revelation_type   text    not null check (revelation_type in ('makkiyyah', 'madaniyyah')),
  ayah_count        smallint not null check (ayah_count > 0),
  word_count        integer  not null check (word_count > 0),
  juz_start         smallint not null check (juz_start between 1 and 30),
  juz_end           smallint not null check (juz_end   between 1 and 30),
  -- Share of isnād mass at each person. Sums to ~1 where any isnād occurs.
  p1                real not null default 0,
  p2                real not null default 0,
  p3                real not null default 0,
  -- 0 = المناجاة (المخاطب) … 1 = الغيبة (الغائب)
  distance          real not null default 0.5 check (distance between 0 and 1),
  -- Deepest قولٌ في جوف قول found in the sūrah.
  max_depth         smallint not null default 0,
  constraint juz_range_ordered check (juz_end >= juz_start)
);

comment on column public.surahs.distance is
  'موضع السورة على محور القرب والبعد: صفرٌ مناجاة، وواحدٌ غيبة';

-- ── الآيات ─────────────────────────────────────────────────────────────────
create table if not exists public.ayaat (
  id                bigserial primary key,
  surah_id          smallint not null references public.surahs(id) on delete cascade,
  ayah              smallint not null check (ayah > 0),
  -- The Uthmani text as published.
  text_uthmani      text not null,
  -- The same āyah rebuilt from its morphological segments; the two differ in
  -- orthographic detail, and the reader's word tokens come from this one.
  text_segmented    text not null,
  juz               smallint not null check (juz between 1 and 30),
  p1                real not null default 0,
  p2                real not null default 0,
  p3                real not null default 0,
  distance          real not null default 0.5,
  -- Compressed person contour, e.g. '1312' for هود ٢٩.
  signature         text not null default '',
  dominant_person   smallint check (dominant_person in (1, 2, 3)),
  -- Past mass × present mass: how far this āyah reaches into the reader's now.
  clock_bridge      real not null default 0,
  unique (surah_id, ayah)
);

create index if not exists ayaat_signature_idx on public.ayaat (signature);
create index if not exists ayaat_distance_idx  on public.ayaat (distance);
create index if not exists ayaat_bridge_idx    on public.ayaat (clock_bridge desc);
create index if not exists ayaat_juz_idx       on public.ayaat (juz);

comment on column public.ayaat.signature is
  'كنتور الإسناد: تعاقب مقاعد الإسناد في الآية بلا تكرار متجاور';

-- ── الكلم ──────────────────────────────────────────────────────────────────
create table if not exists public.words (
  id                bigserial primary key,
  surah_id          smallint not null references public.surahs(id) on delete cascade,
  ayah              smallint not null,
  -- Position within the sūrah's flat word stream, 0-based.
  word_index        integer  not null,
  -- Position within its own āyah, 1-based, as the corpus numbers it.
  word_in_ayah      smallint not null,
  text              text not null,
  root              text,
  lemma             text,
  -- The word's isnād spine: who sits in the attribution chair.
  person            smallint check (person in (1, 2, 3)),
  role              text,
  number            text check (number in ('S', 'D', 'P')),
  gender            text check (gender in ('M', 'F')),
  tense             text check (tense in ('PERF', 'IMPF', 'IMPV')),
  -- Quotation nesting: 0 is narration, 1 is inside one reported saying, etc.
  depth             smallint not null default 0,
  -- Set where a non-human creature holds the chair (ألسنة الخلق).
  khalq_label       text,
  khalq_category    text,
  khalq_speech      boolean not null default false,
  unique (surah_id, word_index),
  foreign key (surah_id, ayah) references public.ayaat (surah_id, ayah) on delete cascade
);

create index if not exists words_root_idx   on public.words (root);
create index if not exists words_person_idx on public.words (person);
create index if not exists words_khalq_idx  on public.words (khalq_label) where khalq_label is not null;

comment on table public.words is
  'الكلم كما وردت في الوسم الصرفي، ولكلٍّ مقعده من الإسناد إن كان له مقعد';

-- ── مواضع الإسناد ──────────────────────────────────────────────────────────
--  One row per person-bearing segment. The distinction this table exists to
--  hold: `is_subject` separates a segment that seats a referent in the
--  attribution chair from one that merely points at a referent. رَبِّهِمْ
--  references a third person; it does not predicate to one.
create table if not exists public.isnad_attributions (
  id                bigserial primary key,
  surah_id          smallint not null references public.surahs(id) on delete cascade,
  word_index        integer  not null,
  segment_index     smallint not null,
  form              text not null,
  person            smallint not null check (person in (1, 2, 3)),
  role              text not null check (role in (
                      'verb-subject', 'subject-enclitic', 'detached', 'nasikh-subject',
                      'object', 'possessive', 'prepositional', 'vocative')),
  is_subject        boolean not null,
  number            text check (number in ('S', 'D', 'P')),
  gender            text check (gender in ('M', 'F')),
  unique (surah_id, word_index, segment_index),
  foreign key (surah_id, word_index) references public.words (surah_id, word_index) on delete cascade
);

create index if not exists isnad_person_idx  on public.isnad_attributions (person, role);
create index if not exists isnad_subject_idx on public.isnad_attributions (surah_id) where is_subject;

comment on column public.isnad_attributions.is_subject is
  'أهو مقعد إسنادٍ حقيقي (مسند إليه) أم مجرد إحالة إلى شخصٍ؟';

-- ── دفتر التدبّر ───────────────────────────────────────────────────────────
create table if not exists public.tadabbur_notes (
  id                uuid primary key default gen_random_uuid(),
  -- Null while the studio runs without auth, which is its normal single-user
  -- mode; the RLS policies below key off it once you turn auth on.
  user_id           uuid references auth.users(id) on delete cascade,
  surah             smallint not null check (surah between 1 and 114),
  ayah              smallint not null check (ayah > 0),
  word_idx          integer,
  body              text not null check (length(btrim(body)) > 0),
  tags              text[] not null default '{}',
  -- The discovery this note was struck from, where it came from one.
  discovery_id      text,
  created_at        timestamptz not null default now()
);

create index if not exists notes_locus_idx on public.tadabbur_notes (surah, ayah);
create index if not exists notes_user_idx  on public.tadabbur_notes (user_id, created_at desc);

-- ── row level security ─────────────────────────────────────────────────────
--  The corpus is public reference material and is readable by anyone holding
--  the anon key. Notes are private: a row is reachable only by the user who
--  wrote it, plus the anonymous single-user case where user_id is null.
alter table public.surahs             enable row level security;
alter table public.ayaat              enable row level security;
alter table public.words              enable row level security;
alter table public.isnad_attributions enable row level security;
alter table public.tadabbur_notes     enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'surahs' and policyname = 'corpus is readable') then
    create policy "corpus is readable" on public.surahs             for select using (true);
    create policy "corpus is readable" on public.ayaat              for select using (true);
    create policy "corpus is readable" on public.words              for select using (true);
    create policy "corpus is readable" on public.isnad_attributions for select using (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'tadabbur_notes' and policyname = 'own notes are readable') then
    create policy "own notes are readable" on public.tadabbur_notes
      for select using (user_id is null or auth.uid() = user_id);
    create policy "own notes are writable" on public.tadabbur_notes
      for insert with check (user_id is null or auth.uid() = user_id);
    create policy "own notes are editable" on public.tadabbur_notes
      for update using (user_id is null or auth.uid() = user_id);
    create policy "own notes are deletable" on public.tadabbur_notes
      for delete using (user_id is null or auth.uid() = user_id);
  end if;
end $$;

-- ── views the studio's questions translate into ────────────────────────────

--  Every seam where the attribution turns, with the words either side of it.
create or replace view public.isnad_seams as
select
  w.surah_id,
  w.ayah,
  w.word_index,
  lag(w.person)  over (partition by w.surah_id order by w.word_index) as person_from,
  w.person                                                            as person_to,
  lag(w.text)    over (partition by w.surah_id order by w.word_index) as word_from,
  w.text                                                              as word_to,
  lag(w.tense)   over (partition by w.surah_id order by w.word_index) as tense_from,
  w.tense                                                             as tense_to
from public.words w
where w.person is not null;

comment on view public.isnad_seams is
  'مواضع الالتفات: كل انتقالٍ بين مقعدَي إسنادٍ متجاورين';

--  Roots that return inside a short span under a different attribution -
--  the SQL counterpart of the رجع الجذر detector.
create or replace view public.root_returns as
select
  a.surah_id,
  a.root,
  a.ayah        as first_ayah,
  a.text        as first_word,
  a.person      as first_person,
  b.ayah        as second_ayah,
  b.text        as second_word,
  b.person      as second_person,
  b.word_index - a.word_index as distance
from public.words a
join public.words b
  on  b.surah_id = a.surah_id
  and b.root     = a.root
  and b.word_index > a.word_index
  and b.word_index - a.word_index <= 22
where a.root is not null
  and (a.person is distinct from b.person or a.depth is distinct from b.depth);

comment on view public.root_returns is
  'رجع الجذر: جذرٌ يعود في مدًى قصير تحت إسنادٍ أو طبقةِ قولٍ مغايرة';

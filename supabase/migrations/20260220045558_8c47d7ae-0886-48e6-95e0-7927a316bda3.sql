
-- Drop and recreate search_mxik_fuzzy with improved multi-word search, word-level matching, and group_name boosting
CREATE OR REPLACE FUNCTION public.search_mxik_fuzzy(p_search_term text, p_limit integer DEFAULT 20)
RETURNS TABLE(
  code text,
  name_uz text,
  name_ru text,
  group_name text,
  vat_rate numeric,
  relevance real
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_words text[];
  v_first_word text;
BEGIN
  -- Split search term into words for multi-word matching
  v_words := string_to_array(lower(trim(p_search_term)), ' ');
  v_first_word := v_words[1];
  
  RETURN QUERY
  WITH candidates AS (
    SELECT 
      m.code,
      m.name_uz,
      m.name_ru,
      m.group_name,
      m.vat_rate,
      -- Multi-signal relevance scoring
      GREATEST(
        -- Full phrase similarity
        similarity(lower(m.name_uz), lower(p_search_term)),
        COALESCE(similarity(lower(m.name_ru), lower(p_search_term)), 0),
        COALESCE(similarity(lower(m.group_name), lower(p_search_term)), 0)
      )::real AS base_similarity,
      -- Exact substring match gets a big boost
      CASE 
        WHEN lower(m.name_ru) ILIKE '%' || lower(p_search_term) || '%' THEN 0.4
        WHEN lower(m.name_uz) ILIKE '%' || lower(p_search_term) || '%' THEN 0.35
        WHEN lower(m.group_name) ILIKE '%' || lower(p_search_term) || '%' THEN 0.25
        ELSE 0
      END::real AS exact_boost,
      -- Word-start match bonus (e.g. "обувь" matches "Обувь спортивная")
      CASE 
        WHEN lower(m.name_ru) ILIKE lower(p_search_term) || '%' THEN 0.3
        WHEN lower(m.name_uz) ILIKE lower(p_search_term) || '%' THEN 0.25
        ELSE 0
      END::real AS start_boost,
      -- Shorter names = more specific = better match (normalize by length)
      CASE 
        WHEN length(m.name_uz) < 40 THEN 0.1
        WHEN length(m.name_uz) < 80 THEN 0.05
        ELSE 0
      END::real AS specificity_boost
    FROM public.mxik_codes m
    WHERE m.is_active = true
      AND (
        -- ILIKE for exact substring
        lower(m.name_uz) ILIKE '%' || lower(p_search_term) || '%'
        OR lower(m.name_ru) ILIKE '%' || lower(p_search_term) || '%'
        OR lower(m.group_name) ILIKE '%' || lower(p_search_term) || '%'
        -- Trigram similarity for fuzzy matching
        OR similarity(lower(m.name_uz), lower(p_search_term)) > 0.15
        OR similarity(lower(COALESCE(m.name_ru, '')), lower(p_search_term)) > 0.15
        -- First word match (catches "обувь" in "обувь мужская")
        OR (v_first_word IS NOT NULL AND length(v_first_word) >= 3 AND (
          lower(m.name_ru) ILIKE '%' || v_first_word || '%'
          OR lower(m.name_uz) ILIKE '%' || v_first_word || '%'
        ))
      )
  )
  SELECT 
    c.code,
    c.name_uz,
    c.name_ru,
    c.group_name,
    c.vat_rate,
    (c.base_similarity + c.exact_boost + c.start_boost + c.specificity_boost)::real AS relevance
  FROM candidates c
  ORDER BY relevance DESC, c.code ASC
  LIMIT p_limit;
END;
$$;

-- Also rebuild search vectors with better Russian config for all records
-- (in batches to avoid timeout)
UPDATE mxik_codes 
SET search_vector = to_tsvector('russian', 
  COALESCE(name_uz, '') || ' ' || 
  COALESCE(name_ru, '') || ' ' || 
  COALESCE(group_name, '')
)
WHERE search_vector IS NULL OR search_vector = ''::tsvector;

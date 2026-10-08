-- Catalog E2E fixtures (storefront-catalog task 2.3), applied after the dev catalog seed.
-- The dev seed has 4 ACTIVE products (one with a price range), 1 INACTIVE, and 4 DRAFT.
-- These add 26 ACTIVE products (30 in all), one ARCHIVED product, and an "outerwear" category.
-- Activation times are later than the dev seed's and one hour apart, so "newest" is exact.
-- Ids are random UUIDs (the store API never exposes them).

CREATE TEMP SEQUENCE e2e_sku;
CREATE TEMP SEQUENCE e2e_hour;

INSERT INTO categories (id, name, slug) VALUES (gen_random_uuid(), 'Outerwear', 'outerwear');

-- variants: [{ "size", "color", "stock", "rupiah"? }]; images: [{ "url", "alt", "color"? }], first
-- is primary. An image "color" links it to the product's first variant of that color.
CREATE FUNCTION pg_temp.fixture(
  p_slug text, p_name text, p_category text, p_rupiah integer, p_variants jsonb,
  p_images jsonb DEFAULT '[]', p_status product_status DEFAULT 'ACTIVE'
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  new_product_id uuid := gen_random_uuid();
  variant jsonb;
  image jsonb;
  position integer := 0;
BEGIN
  INSERT INTO products (id, name, slug, status, category_id, base_price_amount, currency, activated_at)
  SELECT new_product_id, p_name, p_slug, p_status, c.id, p_rupiah * 100, 'IDR',
         timestamptz '2026-10-02 00:00:00Z' + nextval('e2e_hour') * interval '1 hour'
  FROM categories c WHERE c.slug = p_category;

  FOR variant IN SELECT * FROM jsonb_array_elements(p_variants) LOOP
    INSERT INTO product_variants (id, product_id, size_id, color_id, sku, price_override_amount, stock_quantity)
    SELECT gen_random_uuid(), new_product_id, s.id, co.id, 'E2E-' || nextval('e2e_sku'),
           (variant->>'rupiah')::integer * 100, (variant->>'stock')::integer
    FROM sizes s, colors co
    WHERE s.code = variant->>'size' AND co.slug = variant->>'color';
  END LOOP;

  FOR image IN SELECT * FROM jsonb_array_elements(p_images) LOOP
    INSERT INTO product_images (id, product_id, variant_id, url, alt, sort_order, is_primary)
    VALUES (
      gen_random_uuid(), new_product_id,
      (SELECT v.id FROM product_variants v JOIN colors co ON co.id = v.color_id
       WHERE v.product_id = new_product_id AND co.slug = image->>'color'
       ORDER BY length(v.sku), v.sku LIMIT 1),
      image->>'url', image->>'alt', position, position = 0
    );
    position := position + 1;
  END LOOP;
END $$;

-- Nineteen plain tees, the oldest fixtures: one white size S, in stock, 300k + 10k steps.
SELECT pg_temp.fixture(
  'filler-tee-' || lpad(n::text, 2, '0'), 'Filler Tee ' || lpad(n::text, 2, '0'), 'apparel',
  300000 + n * 10000,
  jsonb_build_array(jsonb_build_object('size', 'S', 'color', 'white', 'stock', 10)),
  jsonb_build_array(jsonb_build_object('url', '/images/products/filler-tee/front.jpg', 'alt', 'Filler Tee, front view'))
) FROM generate_series(1, 19) AS n;

-- One size, in the slot of the twentieth tee (same activation hour, so the catalog order holds).
SELECT pg_temp.fixture('allowance-cap', 'Allowance Cap', 'accessories', 289000,
  '[{"size": "OS", "color": "off-white", "stock": 6}]',
  '[{"url": "/images/products/allowance-cap/front.jpg", "alt": "Allowance Cap, front view"}]');

-- Every active variant at zero: SOLD_OUT.
SELECT pg_temp.fixture('sold-out-tee', 'Sold Out Tee', 'apparel', 299000,
  '[{"size": "M", "color": "black", "stock": 0}, {"size": "L", "color": "black", "stock": 0}]',
  '[{"url": "/images/products/sold-out-tee/front.jpg", "alt": "Sold Out Tee, front view"}]');

-- Size M black exists but is sold out; size L black is in stock.
SELECT pg_temp.fixture('last-black-tee', 'Last Black Tee', 'apparel', 259000,
  '[{"size": "M", "color": "black", "stock": 0}, {"size": "L", "color": "black", "stock": 4}]',
  '[{"url": "/images/products/last-black-tee/front.jpg", "alt": "Last Black Tee, front view"}]');

-- Two colors, an in-stock size M black variant, and L only in off-white (sold out). Images:
-- one per color and one tied to no color.
SELECT pg_temp.fixture('two-tone-hoodie', 'Two Tone Hoodie', 'apparel', 699000,
  '[{"size": "M", "color": "black", "stock": 5}, {"size": "M", "color": "off-white", "stock": 3},
    {"size": "L", "color": "off-white", "stock": 0}]',
  '[{"url": "/images/products/two-tone-hoodie/black.jpg", "alt": "Two Tone Hoodie in black, front view", "color": "black"},
    {"url": "/images/products/two-tone-hoodie/off-white.jpg", "alt": "Two Tone Hoodie in off-white, front view", "color": "off-white"},
    {"url": "/images/products/two-tone-hoodie/back.jpg", "alt": "Two Tone Hoodie, back view"}]');

-- No image at all.
SELECT pg_temp.fixture('bare-tee', 'Bare Tee', 'apparel', 279000,
  '[{"size": "S", "color": "white", "stock": 3}]');

-- Outerwear. The parka's image is on a host that is not allowed; the hoodie's is on an allowed
-- host that does not resolve (it fails to load). Both show the placeholder. The hoodie has a range,
-- and its first color by name (Charcoal) is sold out, so its default color is Stone Grey.
SELECT pg_temp.fixture('layoff-parka', 'Layoff Parka', 'outerwear', 1499000,
  '[{"size": "M", "color": "charcoal", "stock": 2}, {"size": "L", "color": "charcoal", "stock": 1}]',
  '[{"url": "https://images.not-allowed.test/parka.jpg", "alt": "Layoff Parka, front view"}]');
SELECT pg_temp.fixture('zip-hoodie', 'Zip Hoodie', 'outerwear', 799000,
  '[{"size": "S", "color": "stone-grey", "stock": 4},
    {"size": "M", "color": "stone-grey", "stock": 6, "rupiah": 829000},
    {"size": "S", "color": "charcoal", "stock": 0}]',
  '[{"url": "https://cdn.e2e.test/zip-hoodie.jpg", "alt": "Zip Hoodie, front view"}]');

-- Archived: never in the catalog.
SELECT pg_temp.fixture('archived-jacket', 'Archived Jacket', 'outerwear', 999000,
  '[{"size": "M", "color": "black", "stock": 8}]',
  '[{"url": "/images/products/archived-jacket/front.jpg", "alt": "Archived Jacket, front view"}]',
  'ARCHIVED');

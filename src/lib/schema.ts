// D1 스키마 정의 — 최초 요청 시 CREATE TABLE IF NOT EXISTS 로 자동 구성된다.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  brand TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  description TEXT DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  sale_price INTEGER,
  thumbnail TEXT DEFAULT '',
  images TEXT DEFAULT '[]',
  options TEXT DEFAULT '[]',
  stock INTEGER DEFAULT 0,
  badge TEXT DEFAULT '',
  rating REAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  shipping_fee INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  marketing_agree INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  label TEXT DEFAULT '',
  receiver TEXT NOT NULL,
  phone TEXT NOT NULL,
  zipcode TEXT DEFAULT '',
  addr1 TEXT NOT NULL,
  addr2 TEXT DEFAULT '',
  is_default INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT NOT NULL,
  user_id INTEGER,
  product_id INTEGER NOT NULL,
  option_text TEXT DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  user_id INTEGER,
  orderer_name TEXT NOT NULL,
  orderer_phone TEXT DEFAULT '',
  receiver TEXT NOT NULL,
  receiver_phone TEXT DEFAULT '',
  zipcode TEXT DEFAULT '',
  addr1 TEXT DEFAULT '',
  addr2 TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  subtotal INTEGER DEFAULT 0,
  discount INTEGER DEFAULT 0,
  shipping_fee INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  pay_method TEXT DEFAULT 'demo',
  coupon_code TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  admin_memo TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  thumbnail TEXT DEFAULT '',
  option_text TEXT DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'amount',
  value INTEGER DEFAULT 0,
  min_order INTEGER DEFAULT 0,
  max_discount INTEGER DEFAULT 0,
  expires_at TEXT DEFAULT '',
  total_count INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  user_id INTEGER,
  author TEXT DEFAULT '',
  rating INTEGER DEFAULT 5,
  content TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  image TEXT DEFAULT '',
  bg TEXT DEFAULT '#111827',
  link TEXT DEFAULT '/',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  is_pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT DEFAULT '관리자'
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_cart_session ON cart_items(session_key);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
`;

export const ORDER_STATUSES: Record<string, string> = {
  pending: '결제대기',
  paid: '결제완료',
  preparing: '상품준비중',
  shipping: '배송중',
  delivered: '배송완료',
  cancelled: '취소',
  refunded: '환불',
};

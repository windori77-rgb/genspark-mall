import { hashPassword } from './auth';

type Cat = { name: string; slug: string; icon: string; sort: number };

export const CATEGORIES: Cat[] = [
  { name: '패션', slug: 'fashion', icon: '👕', sort: 1 },
  { name: '뷰티', slug: 'beauty', icon: '💄', sort: 2 },
  { name: '푸드', slug: 'food', icon: '🍪', sort: 3 },
  { name: '리빙', slug: 'living', icon: '🏠', sort: 4 },
  { name: '디지털', slug: 'digital', icon: '🎧', sort: 5 },
  { name: '스포츠', slug: 'sports', icon: '🏃', sort: 6 },
];

type P = {
  cat: string; name: string; brand: string; summary: string; desc: string;
  price: number; sale: number; thumb: string; images: string[];
  options: { name: string; values: string[] }[]; stock: number; badge: string;
  rating: number; reviews: number; sales: number; ship: number;
};

const SIZE = [{ name: '사이즈', values: ['S', 'M', 'L', 'XL'] }];
const COLOR = [{ name: '색상', values: ['아이보리', '블랙', '그레이'] }];

export const PRODUCTS: P[] = [
  { cat: 'fashion', name: '데일리 코튼 오버핏 티셔츠', brand: 'MOA BASIC', summary: '사계절 입기 좋은 20수 순면 오버핏', desc: '부드러운 20수 순면 원단으로 제작한 데일리 티셔츠입니다. 어깨가 자연스럽게 떨어지는 오버핏 실루엣으로 편안한 착용감을 제공하며, 세탁 후에도 형태가 잘 유지됩니다.', price: 29000, sale: 19900, thumb: '/static/img/tee-1.jpg', images: ['/static/img/tee-1.jpg', '/static/img/tee-2.jpg'], options: [...SIZE, ...COLOR], stock: 120, badge: 'BEST', rating: 4.8, reviews: 142, sales: 1830, ship: 0 },
  { cat: 'fashion', name: '프리미엄 헤비웨이트 반팔티', brand: 'MOA BASIC', summary: '탄탄한 30수 헤비 코튼, 핏이 무너지지 않음', desc: '두께감 있는 헤비 코튼 소재로 제작되어 한 장만 입어도 실루엣이 살아있는 반팔티입니다. 넥라인 리브 조직을 이중으로 보강해 오래 입어도 늘어나지 않습니다.', price: 39000, sale: 25900, thumb: '/static/img/tee-2.jpg', images: ['/static/img/tee-2.jpg', '/static/img/tee-1.jpg'], options: [...SIZE, ...COLOR], stock: 85, badge: '', rating: 4.6, reviews: 87, sales: 940, ship: 0 },
  { cat: 'fashion', name: '에어쿠션 러닝 스니커즈', brand: 'WALKER', summary: '하루 1만 보도 가벼운 에어쿠션 미드솔', desc: '에어쿠션 미드솔을 적용해 충격을 흡수하는 러닝 스니커즈입니다. 통기성 좋은 메쉬 어퍼와 논슬립 아웃솔로 일상은 물론 가벼운 러닝에도 적합합니다.', price: 89000, sale: 69000, thumb: '/static/img/shoe-1.jpg', images: ['/static/img/shoe-1.jpg', '/static/img/shoe-2.jpg', '/static/img/shoe-3.jpg'], options: [{ name: '사이즈', values: ['230', '240', '250', '260', '270', '280'] }], stock: 64, badge: 'BEST', rating: 4.7, reviews: 231, sales: 2210, ship: 0 },
  { cat: 'fashion', name: '클래식 화이트 스니커즈', brand: 'WALKER', summary: '어디에나 어울리는 베이직 화이트', desc: '깔끔한 화이트 컬러의 클래식 스니커즈. 어떤 스타일에도 자연스럽게 어울리며, 쿠션감 있는 인솔로 장시간 착용에도 편안합니다.', price: 79000, sale: 59000, thumb: '/static/img/shoe-2.jpg', images: ['/static/img/shoe-2.jpg', '/static/img/shoe-1.jpg'], options: [{ name: '사이즈', values: ['230', '240', '250', '260', '270', '280'] }], stock: 42, badge: '', rating: 4.5, reviews: 118, sales: 760, ship: 0 },
  { cat: 'fashion', name: '스트리트 척 테이퍼 스니커즈', brand: 'WALKER', summary: '도톰한 아웃솔의 스트리트 무드', desc: '두툼한 아웃솔과 테이퍼드 실루엣으로 스트리트 무드를 완성하는 스니커즈입니다. 발을 안정적으로 잡아주는 구조로 활동량이 많은 날에도 편안합니다.', price: 99000, sale: 89000, thumb: '/static/img/shoe-3.jpg', images: ['/static/img/shoe-3.jpg', '/static/img/shoe-1.jpg'], options: [{ name: '사이즈', values: ['240', '250', '260', '270', '280'] }], stock: 28, badge: 'NEW', rating: 4.4, reviews: 56, sales: 320, ship: 0 },
  { cat: 'fashion', name: '빈티지 캔버스 백팩', brand: 'ROAM', summary: '17인치 노트북 수납 가능한 캔버스 백팩', desc: '두꺼운 캔버스 원단으로 제작한 빈티지 무드 백팩입니다. 17인치 노트북 전용 포켓과 다수의 수납 포켓으로 출퇴근·여행 모두 활용도가 높습니다.', price: 59000, sale: 49000, thumb: '/static/img/bag-1.jpg', images: ['/static/img/bag-1.jpg', '/static/img/bag-2.jpg'], options: [{ name: '색상', values: ['블랙', '브라운', '그린'] }], stock: 51, badge: 'BEST', rating: 4.9, reviews: 203, sales: 1540, ship: 0 },
  { cat: 'fashion', name: '리넨 미니 크로스백', brand: 'ROAM', summary: '가볍게 드는 데일리 미니백', desc: '리넨 소재의 가벼운 미니 크로스백. 스마트폰과 지갑 등 필수품만 간편하게 수납할 수 있어 산책이나 외출 시 부담 없습니다.', price: 45000, sale: 35000, thumb: '/static/img/bag-2.jpg', images: ['/static/img/bag-2.jpg', '/static/img/bag-1.jpg'], options: [{ name: '색상', values: ['크림', '카키'] }], stock: 37, badge: '', rating: 4.3, reviews: 64, sales: 410, ship: 0 },

  { cat: 'beauty', name: '벨벳 매트 립스틱', brand: 'LUMI', summary: '보송하게 밀착되는 벨벳 매트 텍스처', desc: '한 번 바르면 보송하게 밀착되는 벨벳 매트 립스틱입니다. 선명한 발색과 오랜 지속력으로 하루 종일 컬러가 유지됩니다.', price: 32000, sale: 24000, thumb: '/static/img/lip-1.jpg', images: ['/static/img/lip-1.jpg', '/static/img/lip-2.jpg'], options: [{ name: '컬러', values: ['로즈우드', '코랄핑크', '딥레드', '누드베이지'] }], stock: 210, badge: 'BEST', rating: 4.8, reviews: 412, sales: 3120, ship: 0 },
  { cat: 'beauty', name: '글로우 틴트 립밤', brand: 'LUMI', summary: '촉촉한 글로우 오일 틴트', desc: '입술 위에서 녹아내리는 오일 틴트로, 은은한 컬러와 윤기 있는 글로우를 동시에 연출합니다. 건조함 없이 촉촉하게 유지됩니다.', price: 18000, sale: 13500, thumb: '/static/img/lip-2.jpg', images: ['/static/img/lip-2.jpg', '/static/img/lip-1.jpg'], options: [{ name: '컬러', values: ['피치글로우', '체리글로우'] }], stock: 180, badge: '', rating: 4.6, reviews: 255, sales: 1890, ship: 0 },
  { cat: 'beauty', name: '비타민C 브라이트닝 세럼', brand: 'DERMA', summary: '순수 비타민C 15% 고농축 세럼', desc: '고농축 순수 비타민C를 담아 칙칙한 피부 톤을 맑게 가꿔주는 브라이트닝 세럼입니다. 나이아신아마이드가 함께 배합되어 피부 결을 정돈합니다.', price: 42000, sale: 32000, thumb: '/static/img/serum-1.jpg', images: ['/static/img/serum-1.jpg', '/static/img/serum-2.jpg'], options: [{ name: '용량', values: ['30ml', '50ml'] }], stock: 95, badge: 'BEST', rating: 4.7, reviews: 328, sales: 2410, ship: 0 },
  { cat: 'beauty', name: '히알루론 수분 앰플', brand: 'DERMA', summary: '5중 히알루론산 수분 앰플', desc: '5중 히알루론산이 피부 속까지 수분을 전달하는 고보습 앰플입니다. 끈적임 없는 산뜻한 마무리로 모든 피부 타입에 사용 가능합니다.', price: 38000, sale: 28500, thumb: '/static/img/serum-2.jpg', images: ['/static/img/serum-2.jpg', '/static/img/serum-1.jpg'], options: [{ name: '용량', values: ['30ml', '50ml'] }], stock: 130, badge: '', rating: 4.5, reviews: 174, sales: 1120, ship: 0 },

  { cat: 'food', name: '싱글오리진 원두 200g', brand: 'BEAN LAB', summary: '에티오피아 예가체프, 플로럴 노트', desc: '에티오피아 예가체프 싱글오리진 원두로, 화사한 플로럴 향과 은은한 시트러스 산미가 특징입니다. 로스팅 후 7일 이내 발송됩니다.', price: 18000, sale: 14500, thumb: '/static/img/coffee-1.jpg', images: ['/static/img/coffee-1.jpg', '/static/img/coffee-2.jpg'], options: [{ name: '분쇄도', values: ['홀빈', '핸드드립', '에스프레소'] }], stock: 340, badge: 'BEST', rating: 4.9, reviews: 389, sales: 4210, ship: 3000 },
  { cat: 'food', name: '콜드브루 스틱 10입', brand: 'BEAN LAB', summary: '물만 붓면 완성되는 콜드브루', desc: '찬물 또는 우유에 타기만 하면 완성되는 콜드브루 스틱입니다. 부드러운 산미와 묵직한 바디감으로 언제 어디서나 즐길 수 있습니다.', price: 15000, sale: 11900, thumb: '/static/img/coffee-2.jpg', images: ['/static/img/coffee-2.jpg', '/static/img/coffee-1.jpg'], options: [], stock: 420, badge: '', rating: 4.6, reviews: 212, sales: 2680, ship: 3000 },
  { cat: 'food', name: '그래놀라 클러스터 500g', brand: 'MORNING', summary: '무가당 통곡물 그래놀라', desc: '설탕 대신 메이플 시럽으로 은은하게 단맛을 낸 통곡물 그래놀라입니다. 견과류와 건과일이 넉넉히 들어가 요거트와 잘 어울립니다.', price: 16000, sale: 12900, thumb: '/static/img/granola-1.jpg', images: ['/static/img/granola-1.jpg'], options: [], stock: 260, badge: 'NEW', rating: 4.4, reviews: 96, sales: 720, ship: 3000 },

  { cat: 'living', name: '에어프라이어 5.5L', brand: 'HOMEUP', summary: '4인 가족용 대용량 에어프라이어', desc: '5.5L 대용량 바스켓으로 4인 가족도 넉넉하게 조리할 수 있습니다. 360도 열순환 방식으로 기름 없이도 바삭하게 튀겨냅니다.', price: 129000, sale: 89000, thumb: '/static/img/fryer-1.jpg', images: ['/static/img/fryer-1.jpg', '/static/img/fryer-2.jpg'], options: [{ name: '색상', values: ['블랙', '화이트'] }], stock: 45, badge: '특가', rating: 4.7, reviews: 512, sales: 2890, ship: 0 },
  { cat: 'living', name: '미니 오븐 에어프라이어', brand: 'HOMEUP', summary: '에어프라이어 + 오븐 2in1', desc: '에어프라이어와 오븐 기능을 하나로 담은 2in1 모델입니다. 14가지 자동 조리 모드를 지원해 누구나 쉽게 요리할 수 있습니다.', price: 159000, sale: 129000, thumb: '/static/img/fryer-2.jpg', images: ['/static/img/fryer-2.jpg', '/static/img/fryer-1.jpg'], options: [{ name: '색상', values: ['블랙', '실버'] }], stock: 22, badge: '', rating: 4.5, reviews: 143, sales: 610, ship: 0 },
  { cat: 'living', name: '스테인리스 텀블러 600ml', brand: 'FLASK', summary: '보온·보냉 12시간 진공 텀블러', desc: '이중 진공 구조로 보온·보냉이 12시간 유지되는 스테인리스 텀블러입니다. 누수 방지 뚜껑과 미끄럼 방지 바닥 처리가 되어 있습니다.', price: 29000, sale: 19900, thumb: '/static/img/bottle-1.jpg', images: ['/static/img/bottle-1.jpg', '/static/img/bottle-2.jpg'], options: [{ name: '색상', values: ['실버', '블랙', '세이지'] }], stock: 175, badge: 'BEST', rating: 4.8, reviews: 366, sales: 3320, ship: 0 },
  { cat: 'living', name: '보온 보냉 스포츠 보틀 1L', brand: 'FLASK', summary: '운동할 때 넉넉한 1L 대용량', desc: '1L 대용량으로 운동·등산 시 충분한 수분 섭취가 가능합니다. 원터치 뚜껑과 손잡이가 있어 휴대가 편리합니다.', price: 35000, sale: 25900, thumb: '/static/img/bottle-2.jpg', images: ['/static/img/bottle-2.jpg', '/static/img/bottle-1.jpg'], options: [{ name: '색상', values: ['블랙', '네이비'] }], stock: 88, badge: '', rating: 4.4, reviews: 121, sales: 830, ship: 0 },

  { cat: 'digital', name: '노이즈캔슬링 블루투스 헤드폰', brand: 'AUDIX', summary: '액티브 노이즈캔슬링, 40시간 재생', desc: '하이브리드 ANC로 주변 소음을 효과적으로 차단하는 블루투스 헤드폰입니다. 한 번 충전으로 최대 40시간 재생되며 멀티포인트 연결을 지원합니다.', price: 189000, sale: 139000, thumb: '/static/img/head-1.jpg', images: ['/static/img/head-1.jpg', '/static/img/head-2.jpg'], options: [{ name: '색상', values: ['블랙', '아이보리'] }], stock: 58, badge: 'BEST', rating: 4.8, reviews: 634, sales: 3120, ship: 0 },
  { cat: 'digital', name: '무선 오버이어 헤드셋', brand: 'AUDIX', summary: '경량 220g, 통화 품질 강화', desc: '220g의 가벼운 무게로 장시간 착용에도 부담이 없는 오버이어 헤드셋입니다. 빔포밍 마이크를 적용해 화상회의에서도 목소리가 선명하게 전달됩니다.', price: 129000, sale: 99000, thumb: '/static/img/head-2.jpg', images: ['/static/img/head-2.jpg', '/static/img/head-1.jpg'], options: [{ name: '색상', values: ['블랙', '그레이'] }], stock: 74, badge: '', rating: 4.5, reviews: 208, sales: 1240, ship: 0 },
  { cat: 'digital', name: '스마트워치 44mm', brand: 'TECHY', summary: 'AMOLED 디스플레이, 14일 배터리', desc: '선명한 AMOLED 디스플레이와 14일 사용 가능한 배터리를 갖춘 스마트워치입니다. 심박·수면·운동 측정 등 건강 관리 기능을 기본 제공합니다.', price: 249000, sale: 199000, thumb: '/static/img/watch-1.jpg', images: ['/static/img/watch-1.jpg', '/static/img/watch-2.jpg'], options: [{ name: '색상', values: ['블랙', '실버', '로즈'] }, { name: '스트랩', values: ['실리콘', '메탈'] }], stock: 36, badge: '특가', rating: 4.6, reviews: 287, sales: 1410, ship: 0 },
  { cat: 'digital', name: '스마트워치 스포츠 스트랩 세트', brand: 'TECHY', summary: '3종 컬러 스트랩 교체 세트', desc: '스마트워치 전용 스포츠 스트랩 3종 세트입니다. 땀에 강한 소재로 운동 시에도 쾌적하게 착용할 수 있습니다.', price: 39000, sale: 29000, thumb: '/static/img/watch-2.jpg', images: ['/static/img/watch-2.jpg', '/static/img/watch-1.jpg'], options: [{ name: '구성', values: ['3종 세트', '5종 세트'] }], stock: 112, badge: '', rating: 4.3, reviews: 92, sales: 640, ship: 0 },

  { cat: 'sports', name: 'TPE 논슬립 요가매트', brand: 'FITZY', summary: '6mm 두께, 미끄럼 방지 TPE', desc: '친환경 TPE 소재로 제작된 6mm 요가매트입니다. 양면 논슬립 패턴으로 땀이 나도 미끄러지지 않으며, 전용 스트랩이 포함되어 있습니다.', price: 39000, sale: 29000, thumb: '/static/img/yoga-1.jpg', images: ['/static/img/yoga-1.jpg'], options: [{ name: '색상', values: ['퍼플', '그레이', '핑크'] }, { name: '두께', values: ['6mm', '8mm'] }], stock: 143, badge: 'BEST', rating: 4.7, reviews: 318, sales: 2240, ship: 0 },
  { cat: 'sports', name: '요가매트 + 스트랩 세트', brand: 'FITZY', summary: '매트와 정렬 스트랩 구성', desc: '요가매트와 자세 교정용 스트랩을 함께 구성한 세트입니다. 입문자가 올바른 자세를 잡는 데 도움을 줍니다.', price: 45000, sale: 35000, thumb: '/static/img/yoga-1.jpg', images: ['/static/img/yoga-1.jpg'], options: [{ name: '색상', values: ['퍼플', '그레이'] }], stock: 67, badge: '', rating: 4.4, reviews: 104, sales: 520, ship: 0 },
  { cat: 'sports', name: '데일리 트레이닝 반팔티', brand: 'FITZY', summary: '흡습속건 기능성 트레이닝 티', desc: '땀을 빠르게 흡수하고 건조시키는 기능성 원단으로 제작된 트레이닝 반팔티입니다. 신축성이 좋아 어떤 운동에도 편안합니다.', price: 27000, sale: 18900, thumb: '/static/img/tee-2.jpg', images: ['/static/img/tee-2.jpg', '/static/img/tee-1.jpg'], options: [...SIZE, ...COLOR], stock: 158, badge: '', rating: 4.5, reviews: 142, sales: 980, ship: 0 },
  { cat: 'sports', name: '러닝 경량 스니커즈', brand: 'WALKER', summary: '190g 초경량 러닝화', desc: '한 쪽 190g의 초경량 설계로 달릴수록 가벼운 러닝화입니다. 반발력 있는 폼 미드솔이 추진력을 도와줍니다.', price: 85000, sale: 65000, thumb: '/static/img/shoe-1.jpg', images: ['/static/img/shoe-1.jpg', '/static/img/shoe-2.jpg'], options: [{ name: '사이즈', values: ['240', '250', '260', '270', '280'] }], stock: 49, badge: 'NEW', rating: 4.6, reviews: 87, sales: 430, ship: 0 },
  { cat: 'beauty', name: '마일드 클렌징 젤', brand: 'DERMA', summary: '약산성 저자극 클렌징 젤', desc: '약산성 포뮬러로 피부 자극을 최소화한 클렌징 젤입니다. 메이크업 잔여물과 노폐물을 부드럽게 씻어냅니다.', price: 22000, sale: 16500, thumb: '/static/img/serum-2.jpg', images: ['/static/img/serum-2.jpg', '/static/img/serum-1.jpg'], options: [], stock: 205, badge: '', rating: 4.4, reviews: 163, sales: 1310, ship: 0 },
  { cat: 'food', name: '드립백 커피 20입', brand: 'BEAN LAB', summary: '언제 어디서나 간편한 드립백', desc: '개별 포장된 드립백 커피 20입입니다. 뜨거운 물만 있으면 사무실에서도 갓 내린 커피를 즐길 수 있습니다.', price: 19000, sale: 14900, thumb: '/static/img/coffee-1.jpg', images: ['/static/img/coffee-1.jpg', '/static/img/coffee-2.jpg'], options: [], stock: 300, badge: '', rating: 4.5, reviews: 197, sales: 1620, ship: 3000 },
];

export const BANNERS = [
  { title: '가을 신상 최대 40%', subtitle: 'MOA SHOP 단독 특가 · 오늘만 이 가격', image: '/static/img/shoe-3.jpg', bg: '#111827', link: '/category/fashion', sort: 1 },
  { title: '뷰티 베스트 위크', subtitle: '립·세럼 인기템 모아보기', image: '/static/img/lip-1.jpg', bg: '#7f1d1d', link: '/category/beauty', sort: 2 },
  { title: '리빙 살림템 특가전', subtitle: '에어프라이어 8.9만원부터', image: '/static/img/fryer-1.jpg', bg: '#1e3a8a', link: '/category/living', sort: 3 },
];

export const COUPONS = [
  { code: 'WELCOME3000', name: '신규 가입 3,000원 할인', type: 'amount', value: 3000, min: 20000, max: 0, total: 10000 },
  { code: 'MOA10', name: '전 상품 10% 할인 (최대 5,000원)', type: 'percent', value: 10, min: 30000, max: 5000, total: 5000 },
  { code: 'FREESHIP', name: '배송비 무료 쿠폰', type: 'amount', value: 3000, min: 10000, max: 0, total: 99999 },
];

export const NOTICES = [
  { title: 'MOA SHOP 오픈 안내', content: 'MOA SHOP이 새로 문을 열었습니다. 신규 회원에게 3,000원 할인 쿠폰을 드립니다.', pinned: 1 },
  { title: '배송 정책 안내', content: '3만원 이상 구매 시 무료배송이며, 미만 구매 시 배송비 3,000원이 부과됩니다.', pinned: 0 },
  { title: '교환/반품 규정', content: '상품 수령 후 7일 이내 교환 및 반품이 가능합니다. 단, 사용 흔적이 있는 경우 제한될 수 있습니다.', pinned: 0 },
];

export async function seedDatabase(db: D1Database) {
  const stmts: D1PreparedStatement[] = [];

  for (const c of CATEGORIES) {
    stmts.push(db.prepare('INSERT INTO categories (name, slug, icon, sort_order, is_active) VALUES (?,?,?,?,1)')
      .bind(c.name, c.slug, c.icon, c.sort));
  }

  // 카테고리 id 매핑 (sort_order 순서로 1..6)
  const catIds: Record<string, number> = {};
  CATEGORIES.forEach((c, i) => { catIds[c.slug] = i + 1; });

  for (const p of PRODUCTS) {
    stmts.push(db.prepare(
      `INSERT INTO products (category_id, name, brand, summary, description, price, sale_price, thumbnail, images, options, stock, badge, rating, review_count, sales_count, shipping_fee, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`
    ).bind(
      catIds[p.cat], p.name, p.brand, p.summary, p.desc, p.price, p.sale, p.thumb,
      JSON.stringify(p.images), JSON.stringify(p.options), p.stock, p.badge, p.rating, p.reviews, p.sales, p.ship
    ));
  }

  for (const b of BANNERS) {
    stmts.push(db.prepare('INSERT INTO banners (title, subtitle, image, bg, link, sort_order, is_active) VALUES (?,?,?,?,?,?,1)')
      .bind(b.title, b.subtitle, b.image, b.bg, b.link, b.sort));
  }

  for (const c of COUPONS) {
    stmts.push(db.prepare('INSERT INTO coupons (code, name, type, value, min_order, max_discount, expires_at, total_count, used_count, is_active) VALUES (?,?,?,?,?,?,?,?,0,1)')
      .bind(c.code, c.name, c.type, c.value, c.min, c.max, '2027-12-31', c.total));
  }

  for (const n of NOTICES) {
    stmts.push(db.prepare('INSERT INTO notices (title, content, is_pinned) VALUES (?,?,?)')
      .bind(n.title, n.content, n.pinned));
  }

  stmts.push(db.prepare('INSERT INTO admin_users (username, password_hash, name) VALUES (?,?,?)')
    .bind('admin', await hashPassword('admin1234'), '최고관리자'));

  stmts.push(db.prepare('INSERT INTO users (email, password_hash, name, phone, marketing_agree) VALUES (?,?,?,?,1)')
    .bind('demo@moa.shop', await hashPassword('demo1234'), '김모아', '010-1234-5678'));

  const settings: [string, string][] = [
    ['mall_name', 'MOA SHOP'],
    ['mall_tagline', '매일이 조금 더 즐거워지는 쇼핑'],
    ['free_shipping_over', '30000'],
    ['base_shipping_fee', '3000'],
    ['cs_phone', '1588-0000'],
    ['cs_hours', '평일 09:00 ~ 18:00 (주말·공휴일 휠)'],
    ['bank_account', '토스뱅크 1000-0000-0000 (주)모아'],
    ['point_rate', '1'],
  ];
  for (const [k, v] of settings) {
    stmts.push(db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').bind(k, v));
  }

  // 리뷰 샘플
  const reviewSamples = [
    { p: 1, author: '이서연', rating: 5, content: '핏이 정말 예뻐요. 세탁해도 늘어나지 않아서 또 살 예정입니다.' },
    { p: 1, author: '박준호', rating: 4, content: '가성비 좋습니다. 색상이 화면과 거의 같아요.' },
    { p: 3, author: '최민지', rating: 5, content: '하루 종일 신고 다녀도 발이 편해요. 사이즈는 정사이즈 추천!' },
    { p: 6, author: '정하늘', rating: 5, content: '노트북도 들어가고 수납이 넉넉합니다. 마감도 깔끔해요.' },
    { p: 8, author: '한지우', rating: 5, content: '발색 미쳤어요. 지속력도 좋아서 하루 종일 유지됩니다.' },
    { p: 10, author: '오수빈', rating: 4, content: '2주 써봤는데 피부 톤이 확실히 밝아졌어요.' },
    { p: 12, author: '김도윤', rating: 5, content: '향이 정말 좋습니다. 핸드드립으로 내려 마시니 산미가 딱이에요.' },
    { p: 15, author: '윤가람', rating: 5, content: '감자튀김 기름 없이 이렇게 바삭하다니 신기합니다.' },
    { p: 17, author: '서지호', rating: 5, content: '보냉이 진짜 오래가요. 여름에 필수템입니다.' },
    { p: 19, author: '강예린', rating: 5, content: '노캔 성능이 가격대 이상입니다. 출퇴근길이 쾌적해졌어요.' },
    { p: 21, author: '임채원', rating: 4, content: '배터리가 오래가서 좋아요. 화면도 선명합니다.' },
    { p: 23, author: '노아영', rating: 5, content: '미끄러지지 않아서 요가할 때 안정감이 있어요.' },
  ];
  for (const r of reviewSamples) {
    stmts.push(db.prepare('INSERT INTO reviews (product_id, author, rating, content) VALUES (?,?,?,?)')
      .bind(r.p, r.author, r.rating, r.content));
  }

  await db.batch(stmts);
}

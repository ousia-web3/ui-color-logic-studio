export type TestImageCategory = "과일" | "야채" | "한식" | "양식" | "중식";

export type TestImageItem = {
  id: string;
  category: TestImageCategory;
  label: string;
  filename: string;
  imageUrl: string;
  sourcePage: string;
};

const commonsImage = (
  category: TestImageCategory,
  id: string,
  label: string,
  filename: string,
): TestImageItem => {
  const normalized = filename.replaceAll(" ", "_");
  const encoded = encodeURIComponent(normalized);
  return {
    id,
    category,
    label,
    filename,
    imageUrl: `/test-images/${id}.webp`,
    sourcePage: `https://commons.wikimedia.org/wiki/File:${encoded}`,
  };
};

export const TEST_IMAGE_SET: TestImageItem[] = [
  commonsImage("과일", "fruit-01", "빨간 사과", "Red Apple.jpg"),
  commonsImage("과일", "fruit-02", "노란 바나나", "Banana.png"),
  commonsImage("과일", "fruit-03", "오렌지 클로즈업", "Orange Fruit Close-up.jpg"),
  commonsImage("과일", "fruit-04", "자른 키위", "Kiwi (Actinidia chinensis) 1 Luc Viatour.jpg"),
  commonsImage("과일", "fruit-05", "보라 포도", "Fresh purple grapes.jpg"),
  commonsImage("과일", "fruit-06", "빨간 딸기", "Red Strawberry .JPG"),
  commonsImage("과일", "fruit-07", "수박 단면", "Sliced Watermelon fruit.jpg"),
  commonsImage("과일", "fruit-08", "블루베리 클로즈업", "Close up of cluster of ripened wild blueberries fruit.jpg"),
  commonsImage("과일", "fruit-09", "파인애플", "Fresh whole pineapples.jpg"),
  commonsImage("과일", "fruit-10", "용과 단면", "Pitaya cross section ed2.jpg"),

  commonsImage("야채", "vegetable-01", "빨간 토마토", "Tomato je.jpg"),
  commonsImage("야채", "vegetable-02", "주황 당근", "Fresh orange carrots.jpg"),
  commonsImage("야채", "vegetable-03", "초록 브로콜리", "Green Broccoli Vegetable on Brown Wooden Table.jpg"),
  commonsImage("야채", "vegetable-04", "다색 파프리카", "Capsicum annuum fruits IMGP0122.jpg"),
  commonsImage("야채", "vegetable-05", "보라 가지", "Solanum melongena 24 08 2012 (1).JPG"),
  commonsImage("야채", "vegetable-06", "오이 슬라이스", "Slicing cucumber (5442160654).jpg"),
  commonsImage("야채", "vegetable-07", "적양배추 단면", "Red Cabbage cross section showing spirals.jpg"),
  commonsImage("야채", "vegetable-08", "노란 옥수수", "Yellow Corn on the Cob (35115370841).jpg"),
  commonsImage("야채", "vegetable-09", "시금치 잎", "1 cup of raw salad leaves, for example raw spinach..JPG"),
  commonsImage("야채", "vegetable-10", "적양파", "Redonionjf2327.JPG"),

  commonsImage("한식", "korean-01", "비빔밥", "Bibimbap with egg.jpg"),
  commonsImage("한식", "korean-02", "김치찌개", "Korean stew-Kimchi jjigae-05.jpg"),
  commonsImage("한식", "korean-03", "불고기", "Korean barbeque-beef-16.jpg"),
  commonsImage("한식", "korean-04", "삼겹살 상차림", "Samgyeopsal table.jpg"),
  commonsImage("한식", "korean-05", "떡볶이", "Korean.snacks-Tteokbokki-06.jpg"),
  commonsImage("한식", "korean-06", "잡채", "Japchae, Noodles with Sauteed Vegetables.jpg"),
  commonsImage("한식", "korean-07", "냉면", "Jinju naengmyeon (cold noodles).jpg"),
  commonsImage("한식", "korean-08", "김밥", "Gimbap 5.jpg"),
  commonsImage("한식", "korean-09", "한국식 치킨", "Korean fried chicken 240206.jpg"),
  commonsImage("한식", "korean-10", "모둠 전", "Korea-Jeongseon-Various Korean pancakes (jeon)-01.jpg"),

  commonsImage("양식", "western-01", "마르게리타 피자", "Pizza Margherita stu spivack.jpg"),
  commonsImage("양식", "western-02", "토마토 스파게티", "Liat Portal for Foodie Disorder - Spaghetti with Tomato Sauce.jpg"),
  commonsImage("양식", "western-03", "치즈버거와 감자튀김", "Cheeseburgers and french fries.jpg"),
  commonsImage("양식", "western-04", "스테이크", "Steak and eggs at Woods of Windsor restaurant.jpg"),
  commonsImage("양식", "western-05", "시저 샐러드", "Caesar salad as a convenience food.jpg"),
  commonsImage("양식", "western-06", "크루아상", "Croissants 1.jpg"),
  commonsImage("양식", "western-07", "베리 팬케이크", "American Pancakes with banana and blueberries - Jonny's Goring Bar & Kitchen 2026-01-29.jpg"),
  commonsImage("양식", "western-08", "구운 연어", "Grilled plated salmon fillet.jpg"),
  commonsImage("양식", "western-09", "로스트 치킨", "Roasted Chicken.jpg"),
  commonsImage("양식", "western-10", "마카로니 치즈", "Macaroni and cheese (3).jpg"),

  commonsImage("중식", "chinese-01", "베이징덕", "Peking Duck 3.jpg"),
  commonsImage("중식", "chinese-02", "마파두부", "MapoTofu.jpg"),
  commonsImage("중식", "chinese-03", "궁보계정", "Kung-pao-shanghai.jpg"),
  commonsImage("중식", "chinese-04", "모둠 딤섬", "All the dimsum in chinese restaurant.jpg"),
  commonsImage("중식", "chinese-05", "샤오롱바오", "A Xiaolongbao from The Modern Shanghai.jpg"),
  commonsImage("중식", "chinese-06", "차우메인", "Chow mein 1 by yuen.jpg"),
  commonsImage("중식", "chinese-07", "탕수육", "Korean Chinese cuisine-sweet and sour pork-Tangsuyuk.jpg"),
  commonsImage("중식", "chinese-08", "중국식 볶음밥", "Chinese fried rice.jpg"),
  commonsImage("중식", "chinese-09", "훠궈", "Hot Pot.jpg"),
  commonsImage("중식", "chinese-10", "완탕 수프", "Chinese wonton soup on a spoon with vegetables.jpg"),
];

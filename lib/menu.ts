export type MenuItem = { id: string; name: string; price: number; description: string; category: "mains" | "extras" | "drinks" };

export const menu: MenuItem[] = [
  { id: "mi-tim-cat", name: "Mì Tim Cật", price: 40000, description: "Tim và cật", category: "mains" },
  { id: "mi-bo-moc", name: "Mì Bò Mọc", price: 40000, description: "Bò và mọc", category: "mains" },
  { id: "mi-bo-tim", name: "Mì Bò Tim", price: 45000, description: "Bò và tim", category: "mains" },
  { id: "mi-tim-cat-moc", name: "Mì Tim Cật Mọc", price: 50000, description: "Tim, cật và mọc", category: "mains" },
  { id: "mi-bo-tim-cat", name: "Mì Bò Tim Cật", price: 55000, description: "Bò, tim và cật", category: "mains" },
  { id: "mi-dac-biet", name: "Mì Đặc Biệt", price: 65000, description: "Tim, cật, bò, mọc, giò tai", category: "mains" },
  { id: "quay", name: "Quẩy ×5", price: 10000, description: "5 chiếc giòn thơm", category: "extras" },
  { id: "trung-non", name: "Trứng non", price: 15000, description: "Béo mềm", category: "extras" },
  { id: "mi-them", name: "Mì thêm", price: 5000, description: "Thêm một vắt mì", category: "extras" },
  { id: "chan-ga", name: "Chân gà sốt Thái", price: 95000, description: "Chua cay đậm vị", category: "extras" },
  { id: "tra-da", name: "Trà đá", price: 5000, description: "Mát lạnh", category: "drinks" },
  { id: "aquafina", name: "Aquafina", price: 10000, description: "Nước tinh khiết", category: "drinks" },
  { id: "sua-dau", name: "Sữa đậu nành", price: 10000, description: "", category: "drinks" },
  { id: "pepsi", name: "Pepsi chai / lon", price: 10000, description: "", category: "drinks" },
  { id: "sting", name: "Sting chai / lon", price: 10000, description: "", category: "drinks" },
  { id: "cam-twister", name: "Cam Twister", price: 15000, description: "", category: "drinks" },
];

export const formatMoney = (value: number) => `${value.toLocaleString("vi-VN")}₫`;

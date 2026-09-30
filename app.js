const { filterMenu, updateCart, cartTotal } = window.CafeStore;

const menu = [
  { id: 'mali-latte', name: 'มะลิลาเต้', english: 'Mali latte', detail: 'เอสเพรสโซ่ · นมสด · ไซรัปมะลิ', category: 'กาแฟ', price: 95, tag: 'แก้วโปรด', image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=700&q=82', alt: 'กาแฟลาเต้เย็นในแก้วใส' },
  { id: 'honey-americano', name: 'อเมริกาโน่น้ำผึ้ง', english: 'Honey americano', detail: 'กาแฟคั่วกลาง · น้ำผึ้งดอกลำไย', category: 'กาแฟ', price: 85, tag: 'ขายดี', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=700&q=82', alt: 'กาแฟอเมริกาโน่เย็น' },
  { id: 'dirty-coffee', name: 'เดอร์ตี้คอฟฟี่', english: 'Dirty coffee', detail: 'ช็อตเข้ม · นมเย็นเนียนนุ่ม', category: 'กาแฟ', price: 105, tag: 'ห้ามคน', image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=700&q=82', alt: 'กาแฟเดอร์ตี้เลเยอร์นมและเอสเพรสโซ่' },
  { id: 'matcha-cloud', name: 'มัทฉะคลาวด์', english: 'Matcha cloud', detail: 'มัทฉะอุจิ · นมสด · โฟมนุ่ม', category: 'ชา', price: 110, tag: 'แนะนำ', image: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=700&q=82', alt: 'มัทฉะลาเต้สีเขียว' },
  { id: 'thai-tea', name: 'ชาไทยนมสด', english: 'Thai tea', detail: 'ชาไทยหอมเข้ม · นมสด', category: 'ชา', price: 80, tag: '', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=700&q=82', alt: 'ชาเย็นสีส้มในแก้วใส' },
  { id: 'lemon-tea', name: 'ชามะนาวน้ำผึ้ง', english: 'Honey lemon tea', detail: 'ชาซีลอน · มะนาวคั้นสด', category: 'ชา', price: 75, tag: 'สดชื่น', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=700&q=82', alt: 'ชาเลมอนใส่น้ำแข็ง' },
  { id: 'croissant', name: 'ครัวซองต์เนยสด', english: 'Butter croissant', detail: 'อบใหม่ทุกเช้า · เนยฝรั่งเศส', category: 'เบเกอรี', price: 79, tag: 'อบเช้า', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=700&q=82', alt: 'ครัวซองต์อบใหม่สีทอง' },
  { id: 'carrot-cake', name: 'เค้กแครอท', english: 'Carrot cake', detail: 'ครีมชีส · วอลนัต · อบเชย', category: 'เบเกอรี', price: 120, tag: '', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=82', alt: 'เค้กชิ้นตกแต่งด้วยครีม' },
  { id: 'banana-bread', name: 'บานาน่าเบรด', english: 'Banana bread', detail: 'กล้วยหอมสุก · วอลนัต', category: 'เบเกอรี', price: 85, tag: 'โฮมเมด', image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?auto=format&fit=crop&w=700&q=82', alt: 'ขนมปังอบใหม่สำหรับมื้อเช้า' },
];

const categories = ['ทั้งหมด', 'กาแฟ', 'ชา', 'เบเกอรี'];
const state = { category: 'ทั้งหมด', query: '', cart: readCart() };
const $ = (selector) => document.querySelector(selector);
const money = (amount) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(amount);

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem('baan-malak-cart') || '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function saveCart() {
  try {
    localStorage.setItem('baan-malak-cart', JSON.stringify(state.cart));
  } catch {
    showToast('บันทึกตะกร้าในเครื่องนี้ไม่ได้ แต่ยังสั่งต่อได้');
  }
}

function renderCategories() {
  const container = $('#category-list');
  container.replaceChildren();
  for (const category of categories) {
    const button = document.createElement('button');
    button.className = `category-button${state.category === category ? ' active' : ''}`;
    button.type = 'button';
    button.textContent = category;
    button.setAttribute('aria-pressed', String(state.category === category));
    button.addEventListener('click', () => {
      state.category = category;
      renderCategories();
      renderMenu();
    });
    container.append(button);
  }
}

function renderMenu() {
  const filtered = filterMenu(menu, state.category, state.query);
  const grid = $('#menu-grid');
  grid.replaceChildren();
  $('#menu-empty').hidden = filtered.length > 0;
  for (const [index, item] of filtered.entries()) {
    const card = document.createElement('article');
    card.className = 'menu-item';
    card.style.animationDelay = `${Math.min(index * 35, 175)}ms`;
    const imageWrap = document.createElement('div');
    imageWrap.className = 'menu-photo-wrap';
    const image = document.createElement('img');
    image.className = 'menu-photo';
    image.src = item.image;
    image.alt = item.alt;
    image.loading = 'lazy';
    image.addEventListener('error', () => { imageWrap.style.background = 'linear-gradient(135deg, #e1d8c5, #afbd9f)'; image.remove(); }, { once: true });
    imageWrap.append(image);
    if (item.tag) {
      const tag = document.createElement('span');
      tag.className = 'menu-tag';
      tag.textContent = item.tag;
      imageWrap.append(tag);
    }
    const info = document.createElement('div');
    info.className = 'menu-item-info';
    const name = document.createElement('span');
    name.className = 'menu-item-name';
    name.textContent = item.name;
    const description = document.createElement('span');
    description.className = 'menu-item-desc';
    description.textContent = `${item.english} · ${item.detail}`;
    const bottom = document.createElement('div');
    bottom.className = 'menu-item-bottom';
    const price = document.createElement('span');
    price.className = 'menu-price';
    price.textContent = money(item.price);
    const add = document.createElement('button');
    add.className = 'add-item';
    add.type = 'button';
    add.setAttribute('aria-label', `เพิ่ม ${item.name} ลงตะกร้า`);
    add.title = 'เพิ่มลงตะกร้า';
    add.textContent = '+';
    add.addEventListener('click', () => changeItem(item.id, 1));
    bottom.append(price, add);
    info.append(name, description, bottom);
    card.append(imageWrap, info);
    grid.append(card);
  }
}

function changeItem(id, delta) {
  state.cart = updateCart(state.cart, id, delta);
  saveCart();
  renderCart();
  if (delta > 0) showToast(`${menu.find((entry) => entry.id === id).name} เพิ่มในตะกร้าแล้ว`);
}

function renderCart() {
  const container = $('#cart-items');
  container.replaceChildren();
  const entries = menu.filter((item) => state.cart[item.id] > 0);
  const count = entries.reduce((sum, item) => sum + state.cart[item.id], 0);
  const total = cartTotal(menu, state.cart);
  $('#header-count').textContent = count;
  $('#cart-empty').hidden = entries.length > 0;
  $('#cart-summary').hidden = entries.length === 0;
  $('#checkout-button').disabled = entries.length === 0;
  $('#subtotal').textContent = money(total);
  $('#total').textContent = money(total);

  for (const item of entries) {
    const row = document.createElement('div');
    row.className = 'cart-row';
    const detail = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'cart-row-title';
    title.textContent = item.name;
    const price = document.createElement('div');
    price.className = 'cart-row-price';
    price.textContent = money(item.price * state.cart[item.id]);
    detail.append(title, price);
    const quantity = document.createElement('div');
    quantity.className = 'quantity-control';
    const decrement = document.createElement('button');
    decrement.className = 'quantity-button';
    decrement.type = 'button';
    decrement.textContent = '−';
    decrement.setAttribute('aria-label', `ลดจำนวน ${item.name}`);
    decrement.addEventListener('click', () => changeItem(item.id, -1));
    const value = document.createElement('span');
    value.className = 'quantity-value';
    value.textContent = state.cart[item.id];
    const increment = document.createElement('button');
    increment.className = 'quantity-button';
    increment.type = 'button';
    increment.textContent = '+';
    increment.setAttribute('aria-label', `เพิ่มจำนวน ${item.name}`);
    increment.addEventListener('click', () => changeItem(item.id, 1));
    quantity.append(decrement, value, increment);
    row.append(detail, quantity);
    container.append(row);
  }
}

let toastTimer;
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2300);
}

$('#menu-search').addEventListener('input', (event) => {
  state.query = event.target.value;
  renderMenu();
});
$('#cart-shortcut').addEventListener('click', () => $('#order-panel').scrollIntoView({ behavior: 'smooth', block: 'center' }));

const checkoutDialog = $('#checkout-dialog');
$('#checkout-button').addEventListener('click', () => {
  $('#dialog-total').textContent = money(cartTotal(menu, state.cart));
  checkoutDialog.showModal();
  $('#customer-name').focus();
});
$('#dialog-close').addEventListener('click', () => checkoutDialog.close());
checkoutDialog.addEventListener('click', (event) => { if (event.target === checkoutDialog) checkoutDialog.close(); });

$('#checkout-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#customer-name').value.trim();
  if (!name) return;
  const orderNumber = `BM${Date.now().toString().slice(-6)}`;
  $('#confirmation-copy').textContent = `คุณ ${name} สั่งเรียบร้อยแล้ว แวะมารับที่ร้านได้ในประมาณ 15–20 นาที`;
  $('#receipt-number').textContent = `หมายเลขออเดอร์ ${orderNumber}`;
  checkoutDialog.close();
  $('#confirmation-dialog').showModal();
  state.cart = {};
  saveCart();
  renderCart();
  event.currentTarget.reset();
});
$('#confirmation-close').addEventListener('click', () => $('#confirmation-dialog').close());
$('#confirmation-dialog').addEventListener('click', (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });

renderCategories();
renderMenu();
renderCart();
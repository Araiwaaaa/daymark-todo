const store = (() => {
  function filterMenu(menu, category = 'ทั้งหมด', query = '') {
    const normalizedQuery = query.trim().toLocaleLowerCase('th');
    return menu.filter((item) => {
      const matchesCategory = category === 'ทั้งหมด' || item.category === category;
      const searchableText = `${item.name} ${item.english} ${item.detail} ${item.category}`.toLocaleLowerCase('th');
      return matchesCategory && searchableText.includes(normalizedQuery);
    });
  }

  function updateCart(cart, itemId, delta) {
    const next = { ...cart };
    const quantity = Math.max(0, (Number(next[itemId]) || 0) + delta);
    if (quantity === 0) delete next[itemId];
    else next[itemId] = quantity;
    return next;
  }

  function cartTotal(menu, cart) {
    return menu.reduce((total, item) => total + item.price * (Number(cart[item.id]) || 0), 0);
  }

  return { filterMenu, updateCart, cartTotal };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = store;
if (typeof window !== 'undefined') window.CafeStore = store;
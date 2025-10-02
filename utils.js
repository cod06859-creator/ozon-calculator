// Вспомогательные функции, которые могут использоваться в разных модулях

// Форматирование чисел
function formatCurrency(amount) {
    return amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Валидация email (если понадобится в будущем)
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Генератор уникальных ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Дебаунс функция для оптимизации
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
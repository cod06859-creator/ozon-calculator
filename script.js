// Глобальные переменные
let tariffData = [];
let currentScheme = 'fbo';
let calculationHistory = [];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadCalculationHistory();
});

function initializeApp() {
    loadExcelFile('tariffs.xlsx');
    updateVolume();
}

function setupEventListeners() {
    document.getElementById('calculateBtn').addEventListener('click', calculate);
    document.getElementById('resetBtn').addEventListener('click', resetForm);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
    document.getElementById('exportBtn').addEventListener('click', exportCalculation);
    document.getElementById('exportHistoryBtn').addEventListener('click', exportHistory);
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchScheme(this.dataset.scheme);
        });
    });
    
    ['length', 'width', 'height'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateVolume);
    });
}

// Загрузка Excel файла
function loadExcelFile(filename) {
    fetch(filename)
        .then(response => {
            if (!response.ok) throw new Error('Файл не найден');
            return response.arrayBuffer();
        })
        .then(data => parseExcelData(data))
        .catch(error => {
            showNotification('Ошибка загрузки тарифов. Проверьте файл tariffs.xlsx', 'error');
        });
}

// Парсинг данных из Excel
function parseExcelData(data) {
    try {
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length > 1) {
            const headers = jsonData[0];
            tariffData = jsonData.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = row[index] || '';
                });
                return obj;
            });
            
            populateCategories();
        }
    } catch (error) {
        showNotification('Ошибка при чтении файла тарифов', 'error');
    }
}

// Заполнение категорий
function populateCategories() {
    const categorySelect = document.getElementById('category');
    categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
    
    if (!tariffData || tariffData.length === 0) return;
    
    const categories = [...new Set(tariffData.map(item => item['Категория']))]
        .filter(cat => cat && cat.trim())
        .sort();
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

// Расчет объема
function updateVolume() {
    const length = parseFloat(document.getElementById('length').value) || 0;
    const width = parseFloat(document.getElementById('width').value) || 0;
    const height = parseFloat(document.getElementById('height').value) || 0;
    const volume = (length * width * height) / 1000;
    document.getElementById('volumeValue').textContent = volume.toFixed(1);
}

// Переключение схем
function switchScheme(scheme) {
    currentScheme = scheme;
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.scheme === scheme) tab.classList.add('active');
    });
    if (document.getElementById('price').value) calculate();
}

// Основная функция расчета
function calculate() {
    const category = document.getElementById('category').value;
    const price = parseFloat(document.getElementById('price').value);
    const quantity = parseInt(document.getElementById('quantity').value);
    const weight = parseFloat(document.getElementById('weight').value) || 1;
    
    if (!validateInputs(category, price, quantity)) return;
    
    const tariff = findTariffForCategory(category);
    if (!tariff) return;
    
    const commissionPercent = calculateCommission(tariff, price);
    const commissionAmount = (price * commissionPercent / 100) * quantity;
    const logisticCost = calculateLogistic(weight, quantity);
    const storageCost = calculateStorage(weight, quantity);
    const totalRevenue = price * quantity;
    const totalCosts = commissionAmount + logisticCost + storageCost;
    const profit = totalRevenue - totalCosts;
    const profitPercentage = (profit / totalRevenue) * 100;
    
    displayResults(price, commissionAmount, logisticCost, storageCost, totalCosts, profit, profitPercentage);
    saveToHistory(category, price, quantity, profit);
}

// Валидация ввода
function validateInputs(category, price, quantity) {
    if (!category) {
        showNotification('Выберите категорию товара', 'error');
        return false;
    }
    if (!price || price <= 0) {
        showNotification('Введите корректную цену товара', 'error');
        return false;
    }
    if (!quantity || quantity <= 0) {
        showNotification('Введите корректное количество', 'error');
        return false;
    }
    if (tariffData.length === 0) {
        showNotification('Тарифы не загружены', 'error');
        return false;
    }
    return true;
}

// Поиск тарифа для категории
function findTariffForCategory(category) {
    const tariff = tariffData.find(item => item['Категория'] === category);
    if (!tariff) showNotification(`Не найден тариф для категории: ${category}`, 'error');
    return tariff;
}

// Расчет комиссии
function calculateCommission(tariff, price) {
    const commissionKey = getCommissionKey(price);
    const commissionValue = tariff[commissionKey];
    
    if (!commissionValue) return 15;
    
    const commissionStr = commissionValue.toString()
        .replace('%', '')
        .replace(',', '.')
        .trim();
    
    return parseFloat(commissionStr) || 15;
}

// Определение ключа комиссии
function getCommissionKey(price) {
    if (currentScheme === 'fbo') {
        if (price <= 100) return 'FBO до 100 руб.';
        if (price <= 300) return 'FBO свыше 100 до 300 руб.';
        if (price <= 500) return 'FBO свыше 300 до 500 руб.';
        if (price <= 1500) return 'FBO свыше 500 до 1500 руб.';
        return 'FBO свыше 1500 руб.';
    } else {
        if (price <= 100) return 'FBS до 100 руб.';
        if (price <= 300) return 'FBS свыше 100 до 300 руб.';
        return 'FBS свыше 300 руб.';
    }
}

// Расчет логистики
function calculateLogistic(weight, quantity) {
    return (50 + weight * 10) * quantity;
}

// Расчет хранения
function calculateStorage(weight, quantity) {
    return (weight * 5 * 0.5) * quantity;
}

// Отображение результатов
function displayResults(price, commission, logistic, storage, totalCosts, profit, percentage) {
    document.getElementById('resultPrice').textContent = `${price.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultCommission').textContent = `-${commission.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultLogistic').textContent = `-${logistic.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultStorage').textContent = `-${storage.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultTotalCosts').textContent = `-${totalCosts.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultProfit').textContent = `${profit.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultPercentage').textContent = `${percentage.toFixed(1)}%`;
}

// Сохранение в историю
function saveToHistory(category, price, quantity, profit) {
    const calculation = {
        id: Date.now(),
        category: category,
        price: price,
        quantity: quantity,
        profit: Math.round(profit),
        date: new Date().toLocaleString('ru-RU'),
        scheme: currentScheme
    };
    
    calculationHistory.unshift(calculation);
    localStorage.setItem('calculationHistory', JSON.stringify(calculationHistory));
    renderHistory();
}

// Загрузка истории
function loadCalculationHistory() {
    const saved = localStorage.getItem('calculationHistory');
    if (saved) {
        calculationHistory = JSON.parse(saved);
        renderHistory();
    }
}

// Отображение истории
function renderHistory() {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = '';
    
    if (calculationHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666;">История расчетов пуста</td></tr>';
        return;
    }
    
    calculationHistory.forEach(calc => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${calc.category}</td>
            <td>${calc.price} ₽</td>
            <td>${calc.quantity}</td>
            <td>${calc.profit} ₽</td>
            <td>${calc.date}</td>
        `;
        tbody.appendChild(row);
    });
}

// Очистка истории
function clearHistory() {
    if (calculationHistory.length === 0) return;
    if (confirm('Очистить всю историю расчетов?')) {
        calculationHistory = [];
        localStorage.removeItem('calculationHistory');
        renderHistory();
    }
}

// Сброс формы
function resetForm() {
    document.getElementById('price').value = '';
    document.getElementById('quantity').value = '1';
    document.getElementById('weight').value = '';
    document.getElementById('length').value = '';
    document.getElementById('width').value = '';
    document.getElementById('height').value = '';
    document.getElementById('volumeValue').textContent = '0';
    
    document.getElementById('resultPrice').textContent = '0 ₽';
    document.getElementById('resultCommission').textContent = '-0 ₽';
    document.getElementById('resultLogistic').textContent = '-0 ₽';
    document.getElementById('resultStorage').textContent = '-0 ₽';
    document.getElementById('resultTotalCosts').textContent = '-0 ₽';
    document.getElementById('resultProfit').textContent = '0 ₽';
    document.getElementById('resultPercentage').textContent = '0%';
}

// Экспорт расчета
function exportCalculation() {
    if (calculationHistory.length === 0) return;
    const data = calculationHistory[0];
    const worksheet = XLSX.utils.json_to_sheet([data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Расчет');
    XLSX.writeFile(workbook, `calculation_${new Date().getTime()}.xlsx`);
}

// Экспорт истории
function exportHistory() {
    if (calculationHistory.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(calculationHistory);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'История расчетов');
    XLSX.writeFile(workbook, `history_${new Date().getTime()}.xlsx`);
}

// Уведомления
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        z-index: 1000;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 300px;
    `;
    
    if (type === 'success') notification.style.background = '#28a745';
    else if (type === 'error') notification.style.background = '#dc3545';
    else if (type === 'warning') notification.style.background = '#ffc107';
    else notification.style.background = '#17a2b8';
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

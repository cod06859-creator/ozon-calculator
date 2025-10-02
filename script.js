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
    // Загружаем Excel файл при инициализации
    loadExcelFile('tariffs.xlsx');
    
    // Инициализация расчета объема
    updateVolume();
}

function setupEventListeners() {
    // Основные элементы управления
    document.getElementById('calculateBtn').addEventListener('click', calculate);
    document.getElementById('resetBtn').addEventListener('click', resetForm);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
    document.getElementById('exportBtn').addEventListener('click', exportCalculation);
    document.getElementById('exportHistoryBtn').addEventListener('click', exportHistory);
    
    // Переключение схем
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchScheme(this.dataset.scheme);
        });
    });
    
    // Автоматический расчет объема
    ['length', 'width', 'height'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateVolume);
    });
}

// Загрузка Excel файла из папки проекта
function loadExcelFile(filename) {
    fetch(filename)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Не удалось загрузить файл: ${filename}`);
            }
            return response.arrayBuffer();
        })
        .then(data => {
            parseExcelData(data);
            showNotification('Тарифы успешно загружены', 'success');
        })
        .catch(error => {
            console.error('Ошибка загрузки Excel файла:', error);
            showNotification('Ошибка загрузки тарифов. Проверьте наличие файла tariffs.xlsx', 'error');
        });
}

// Парсинг данных из Excel
function parseExcelData(data) {
    try {
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Предполагаем, что данные находятся на первом листе
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length > 0) {
            const headers = jsonData[0];
            tariffData = jsonData.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = row[index] || '';
                });
                return obj;
            });
            
            populateCategories();
            console.log('Загружено тарифов:', tariffData.length);
        }
    } catch (error) {
        console.error('Ошибка при парсинге Excel:', error);
        showNotification('Ошибка при чтении файла тарифов', 'error');
    }
}

// Заполнение категорий в выпадающем списке
function populateCategories() {
    const categorySelect = document.getElementById('category');
    categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
    
    if (!tariffData || tariffData.length === 0) {
        showNotification('Нет данных для загрузки категорий', 'warning');
        return;
    }
    
    const categories = [...new Set(tariffData.map(item => item['Категория']))].filter(Boolean);
    
    if (categories.length === 0) {
        showNotification('В файле не найдены категории', 'warning');
        return;
    }
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
    
    console.log(`Загружено ${categories.length} категорий`);
}

// Расчет объема
function updateVolume() {
    const length = parseFloat(document.getElementById('length').value) || 0;
    const width = parseFloat(document.getElementById('width').value) || 0;
    const height = parseFloat(document.getElementById('height').value) || 0;
    
    const volume = (length * width * height) / 1000; // в литрах
    document.getElementById('volumeValue').textContent = volume.toFixed(1);
}

// Переключение между схемами FBO/FBS
function switchScheme(scheme) {
    currentScheme = scheme;
    
    // Обновляем активную вкладку
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.scheme === scheme) {
            tab.classList.add('active');
        }
    });
    
    // Пересчитываем если есть данные
    if (document.getElementById('price').value) {
        calculate();
    }
}

// Основная функция расчета
function calculate() {
    const category = document.getElementById('category').value;
    const price = parseFloat(document.getElementById('price').value);
    const quantity = parseInt(document.getElementById('quantity').value);
    const weight = parseFloat(document.getElementById('weight').value) || 1;
    
    // Валидация
    if (!category) {
        showNotification('Выберите категорию товара', 'error');
        return;
    }
    
    if (!price || price <= 0) {
        showNotification('Введите корректную цену товара', 'error');
        return;
    }
    
    if (!quantity || quantity <= 0) {
        showNotification('Введите корректное количество', 'error');
        return;
    }
    
    if (tariffData.length === 0) {
        showNotification('Тарифы не загружены', 'error');
        return;
    }
    
    // Поиск тарифа для выбранной категории
    const tariff = tariffData.find(item => item['Категория'] === category);
    if (!tariff) {
        showNotification(`Не найден тариф для категории: ${category}`, 'error');
        return;
    }
    
    // Расчет комиссии в зависимости от цены и схемы
    const commissionPercent = calculateCommission(tariff, price, currentScheme);
    const commissionAmount = (price * commissionPercent / 100) * quantity;
    
    // Расчет логистики (упрощенный)
    const logisticCost = calculateLogistic(weight, quantity);
    
    // Расчет стоимости хранения (упрощенный)
    const storageCost = calculateStorage(weight, quantity);
    
    // Итоговые расчеты
    const totalRevenue = price * quantity;
    const totalCosts = commissionAmount + logisticCost + storageCost;
    const profit = totalRevenue - totalCosts;
    const profitPercentage = (profit / totalRevenue) * 100;
    
    // Отображение результатов
    displayResults(price, commissionAmount, logisticCost, storageCost, totalCosts, profit, profitPercentage);
    
    // Сохранение в историю
    saveToHistory(category, price, quantity, profit);
}

// Расчет комиссии на основе тарифа
function calculateCommission(tariff, price, scheme) {
    let commissionKey = '';
    
    // Определяем ключ столбца в зависимости от схемы и ценового диапазона
    if (scheme === 'fbo') {
        if (price <= 100) commissionKey = 'FBO до 100 руб.';
        else if (price <= 300) commissionKey = 'FBO свыше 100 до 300 руб.';
        else if (price <= 500) commissionKey = 'FBO свыше 300 до 500 руб.';
        else if (price <= 1500) commissionKey = 'FBO свыше 500 до 1500 руб.';
        else commissionKey = 'FBO свыше 1500 руб.';
    } else { // fbs
        if (price <= 100) commissionKey = 'FBS до 100 руб.';
        else if (price <= 300) commissionKey = 'FBS свыше 100 до 300 руб.';
        else commissionKey = 'FBS свыше 300 руб.';
    }
    
    // Получаем значение комиссии из тарифа
    const commissionValue = tariff[commissionKey];
    if (!commissionValue) {
        console.warn(`Не найдена комиссия для ключа: ${commissionKey}`);
        return 15; // Комиссия по умолчанию
    }
    
    // Парсим процентное значение (может быть в формате "14,00%")
    const commissionStr = commissionValue.toString().replace('%', '').replace(',', '.').trim();
    const commission = parseFloat(commissionStr);
    
    return isNaN(commission) ? 15 : commission;
}

// Расчет логистики (упрощенная модель)
function calculateLogistic(weight, quantity) {
    // Базовая стоимость + стоимость за вес
    const baseCost = 50;
    const weightCost = weight * 10;
    return (baseCost + weightCost) * quantity;
}

// Расчет стоимости хранения (упрощенная модель)
function calculateStorage(weight, quantity) {
    // 5 руб/кг в месяц, предполагаем 15 дней хранения
    return (weight * 5 * 0.5) * quantity;
}

// Отображение результатов расчета
function displayResults(price, commission, logistic, storage, totalCosts, profit, percentage) {
    document.getElementById('resultPrice').textContent = `${price.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultCommission').textContent = `-${commission.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultLogistic').textContent = `-${logistic.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultStorage').textContent = `-${storage.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultTotalCosts').textContent = `-${totalCosts.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultProfit').textContent = `${profit.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultPercentage').textContent = `${percentage.toFixed(1)}%`;
}

// Сохранение расчета в историю
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
    
    // Сохраняем в localStorage
    localStorage.setItem('calculationHistory', JSON.stringify(calculationHistory));
    
    // Обновляем отображение истории
    renderHistory();
}

// Загрузка истории из localStorage
function loadCalculationHistory() {
    const saved = localStorage.getItem('calculationHistory');
    if (saved) {
        calculationHistory = JSON.parse(saved);
        renderHistory();
    }
}

// Отображение истории расчетов
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
    
    if (confirm('Вы уверены, что хотите очистить всю историю расчетов?')) {
        calculationHistory = [];
        localStorage.removeItem('calculationHistory');
        renderHistory();
        showNotification('История расчетов очищена', 'success');
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
    
    // Сбрасываем результаты
    document.getElementById('resultPrice').textContent = '0 ₽';
    document.getElementById('resultCommission').textContent = '-0 ₽';
    document.getElementById('resultLogistic').textContent = '-0 ₽';
    document.getElementById('resultStorage').textContent = '-0 ₽';
    document.getElementById('resultTotalCosts').textContent = '-0 ₽';
    document.getElementById('resultProfit').textContent = '0 ₽';
    document.getElementById('resultPercentage').textContent = '0%';
    
    showNotification('Форма сброшена', 'info');
}

// Экспорт текущего расчета
function exportCalculation() {
    if (calculationHistory.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    const data = calculationHistory[0]; // Последний расчет
    const worksheet = XLSX.utils.json_to_sheet([data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Расчет');
    XLSX.writeFile(workbook, `calculation_${new Date().getTime()}.xlsx`);
    showNotification('Расчет экспортирован в Excel', 'success');
}

// Экспорт всей истории
function exportHistory() {
    if (calculationHistory.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    const worksheet = XLSX.utils.json_to_sheet(calculationHistory);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'История расчетов');
    XLSX.writeFile(workbook, `history_${new Date().getTime()}.xlsx`);
    showNotification('История экспортирована в Excel', 'success');
}

// Вспомогательная функция для уведомлений
function showNotification(message, type = 'info') {
    // Создаем временное уведомление
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
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
    
    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}
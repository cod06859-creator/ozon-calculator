let tariffData = [];
let calculationHistory = [];

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
    
    ['length', 'width', 'height'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateVolume);
    });
}

function loadExcelFile(filename) {
    fetch(filename)
        .then(response => {
            if (!response.ok) throw new Error('Файл не найден');
            return response.arrayBuffer();
        })
        .then(data => parseExcelData(data))
        .catch(error => {
            showNotification('Ошибка загрузки файла тарифов', 'error');
        });
}

function parseExcelData(data) {
    try {
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Ищем вкладку с комиссиями по разным возможным названиям
        const sheetNames = workbook.SheetNames;
        let commissionSheet = null;
        
        // Пробуем найти вкладку с комиссиями
        for (let name of sheetNames) {
            if (name.includes('Комиссии') || name.includes('комиссии') || 
                name.includes('Commission') || name.includes('commission')) {
                commissionSheet = workbook.Sheets[name];
                break;
            }
        }
        
        // Если не нашли, берем первую вкладку
        if (!commissionSheet) {
            commissionSheet = workbook.Sheets[sheetNames[0]];
        }
        
        const jsonData = XLSX.utils.sheet_to_json(commissionSheet, { header: 1 });
        
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
            showNotification('Тарифы успешно загружены', 'success');
        }
    } catch (error) {
        showNotification('Ошибка при чтении файла тарифов', 'error');
    }
}

function populateCategories() {
    const categorySelect = document.getElementById('category');
    categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
    
    if (!tariffData || tariffData.length === 0) return;
    
    const categories = [...new Set(tariffData.map(item => item['Категория']))]
        .filter(cat => cat && cat.toString().trim())
        .sort();
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

function updateVolume() {
    const length = parseFloat(document.getElementById('length').value) || 0;
    const width = parseFloat(document.getElementById('width').value) || 0;
    const height = parseFloat(document.getElementById('height').value) || 0;
    const volume = (length * width * height) / 1000;
    document.getElementById('volumeValue').textContent = volume.toFixed(1);
}

function calculate() {
    // Основные параметры
    const category = document.getElementById('category').value;
    const price = parseFloat(document.getElementById('price').value);
    const purchasePrice = parseFloat(document.getElementById('purchasePrice').value);
    const deliveryCost = parseFloat(document.getElementById('deliveryCost').value) || 0;
    const packagingCost = parseFloat(document.getElementById('packagingCost').value) || 0;
    const quantity = parseInt(document.getElementById('quantity').value);
    const weight = parseFloat(document.getElementById('weight').value) || 1;
    const redemptionRate = parseFloat(document.getElementById('redemptionRate').value) || 80;
    const advertisingPercent = parseFloat(document.getElementById('advertisingPercent').value) || 0;

    if (!validateInputs(category, price, purchasePrice, quantity)) return;

    const tariff = findTariffForCategory(category);
    if (!tariff) return;

    // Расчет себестоимости
    const costPrice = purchasePrice + deliveryCost + packagingCost;

    // Расчет комиссии Ozon
    const commissionPercent = calculateCommission(tariff, price);
    const commissionAmount = price * commissionPercent / 100;

    // Расчет дополнительных расходов
    const acquiringAmount = price * 0.015; // Эквайринг 1.5%
    const advertisingAmount = price * advertisingPercent / 100;
    
    // Расчет логистики (упрощенная модель)
    const logisticCost = calculateLogistic(weight);
    const customerDelivery = 25; // Базовая доставка до клиента
    const totalLogistic = logisticCost + customerDelivery;

    // Итоговые расчеты
    const totalOzonExpenses = commissionAmount + acquiringAmount + advertisingAmount + totalLogistic;
    const revenueAfterOzon = price - totalOzonExpenses;
    const tax = revenueAfterOzon * 0.06; // Налог УСН 6%
    const profitPerUnit = revenueAfterOzon - costPrice - tax;
    const margin = (profitPerUnit / price) * 100;
    
    // Расчет для всей партии с учетом процента выкупа
    const expectedSales = Math.round(quantity * redemptionRate / 100);
    const batchProfit = profitPerUnit * expectedSales;

    // Отображение результатов
    displayResults(
        purchasePrice, deliveryCost, packagingCost, costPrice,
        commissionAmount, commissionPercent, acquiringAmount, advertisingAmount,
        logisticCost, customerDelivery, totalLogistic,
        price, totalOzonExpenses, tax, profitPerUnit, margin, batchProfit
    );

    // Сохранение в историю
    saveToHistory(category, price, purchasePrice, profitPerUnit, quantity, batchProfit);
}

function validateInputs(category, price, purchasePrice, quantity) {
    if (!category) {
        showNotification('Выберите категорию товара', 'error');
        return false;
    }
    if (!price || price <= 0) {
        showNotification('Введите корректную цену продажи', 'error');
        return false;
    }
    if (!purchasePrice || purchasePrice <= 0) {
        showNotification('Введите корректную закупочную цену', 'error');
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

function findTariffForCategory(category) {
    const tariff = tariffData.find(item => item['Категория'] === category);
    if (!tariff) showNotification(`Не найден тариф для категории: ${category}`, 'error');
    return tariff;
}

function calculateCommission(tariff, price) {
    let commissionKey = '';
    
    if (price <= 100) commissionKey = 'FBO до 100 руб.';
    else if (price <= 300) commissionKey = 'FBO свыше 100 до 300 руб.';
    else if (price <= 500) commissionKey = 'FBO свыше 300 до 500 руб.';
    else if (price <= 1500) commissionKey = 'FBO свыше 500 до 1500 руб.';
    else commissionKey = 'FBO свыше 1500 руб.';
    
    const commissionValue = tariff[commissionKey];
    if (!commissionValue) return 15;
    
    const commissionStr = commissionValue.toString()
        .replace('%', '')
        .replace(',', '.')
        .trim();
    
    return parseFloat(commissionStr) || 15;
}

function calculateLogistic(weight) {
    // Упрощенный расчет логистики на основе веса
    if (weight <= 0.5) return 40;
    if (weight <= 1) return 50;
    if (weight <= 2) return 70;
    if (weight <= 5) return 120;
    if (weight <= 10) return 200;
    return 300; // свыше 10 кг
}

function displayResults(
    purchasePrice, deliveryCost, packagingCost, costPrice,
    commissionAmount, commissionPercent, acquiringAmount, advertisingAmount,
    logisticCost, customerDelivery, totalLogistic,
    price, totalOzonExpenses, tax, profitPerUnit, margin, batchProfit
) {
    // Себестоимость
    document.getElementById('resultPurchase').textContent = `${purchasePrice.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultDelivery').textContent = `${deliveryCost.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultPackaging').textContent = `${packagingCost.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultCostPrice').textContent = `${costPrice.toLocaleString('ru-RU')} ₽`;
    
    // Расходы Ozon
    document.getElementById('resultCommission').textContent = 
        `${commissionAmount.toLocaleString('ru-RU')} ₽ (${commissionPercent.toFixed(2)}%)`;
    document.getElementById('resultAcquiring').textContent = `${acquiringAmount.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultAdvertising').textContent = `${advertisingAmount.toLocaleString('ru-RU')} ₽`;
    
    // Логистика
    document.getElementById('resultLogistic').textContent = `${logisticCost.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultCustomerDelivery').textContent = `${customerDelivery.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultTotalLogistic').textContent = `${totalLogistic.toLocaleString('ru-RU')} ₽`;
    
    // Итоги
    document.getElementById('resultRevenue').textContent = `${price.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultTotalExpenses').textContent = `${totalOzonExpenses.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultTax').textContent = `${tax.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultProfitPerUnit').textContent = `${profitPerUnit.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultMargin').textContent = `${margin.toFixed(1)}%`;
    document.getElementById('resultBatchProfit').textContent = `${batchProfit.toLocaleString('ru-RU')} ₽`;
}

function saveToHistory(category, price, purchasePrice, profitPerUnit, quantity, batchProfit) {
    const calculation = {
        id: Date.now(),
        category: category,
        price: price,
        purchasePrice: purchasePrice,
        profitPerUnit: Math.round(profitPerUnit),
        quantity: quantity,
        batchProfit: Math.round(batchProfit),
        date: new Date().toLocaleString('ru-RU')
    };
    
    calculationHistory.unshift(calculation);
    localStorage.setItem('calculationHistory', JSON.stringify(calculationHistory));
    renderHistory();
}

function loadCalculationHistory() {
    const saved = localStorage.getItem('calculationHistory');
    if (saved) {
        calculationHistory = JSON.parse(saved);
        renderHistory();
    }
}

function renderHistory() {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = '';
    
    if (calculationHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">История расчетов пуста</td></tr>';
        return;
    }
    
    calculationHistory.forEach(calc => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${calc.category}</td>
            <td>${calc.price} ₽</td>
            <td>${calc.purchasePrice} ₽</td>
            <td>${calc.profitPerUnit} ₽</td>
            <td>${calc.quantity} шт</td>
            <td>${calc.date}</td>
        `;
        tbody.appendChild(row);
    });
}

function clearHistory() {
    if (calculationHistory.length === 0) return;
    if (confirm('Очистить всю историю расчетов?')) {
        calculationHistory = [];
        localStorage.removeItem('calculationHistory');
        renderHistory();
        showNotification('История очищена', 'success');
    }
}

function resetForm() {
    document.getElementById('price').value = '';
    document.getElementById('purchasePrice').value = '';
    document.getElementById('deliveryCost').value = '';
    document.getElementById('packagingCost').value = '';
    document.getElementById('quantity').value = '1';
    document.getElementById('weight').value = '';
    document.getElementById('length').value = '';
    document.getElementById('width').value = '';
    document.getElementById('height').value = '';
    document.getElementById('redemptionRate').value = '80';
    document.getElementById('advertisingPercent').value = '5';
    document.getElementById('volumeValue').textContent = '0';
    
    showNotification('Форма сброшена', 'info');
}

function exportCalculation() {
    if (calculationHistory.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    const data = [calculationHistory[0]];
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Расчет');
    XLSX.writeFile(workbook, `calculation_${new Date().getTime()}.xlsx`);
    showNotification('Расчет экспортирован', 'success');
}

function exportHistory() {
    if (calculationHistory.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    const worksheet = XLSX.utils.json_to_sheet(calculationHistory);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'История расчетов');
    XLSX.writeFile(workbook, `history_${new Date().getTime()}.xlsx`);
    showNotification('История экспортирована', 'success');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        z-index: 1000;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 300px;
    `;
    
    if (type === 'success') notification.style.background = '#27ae60';
    else if (type === 'error') notification.style.background = '#e74c3c';
    else if (type === 'warning') notification.style.background = '#f39c12';
    else notification.style.background = '#3498db';
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}
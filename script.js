// Константы приложения
const APP_CONFIG = {
    TAX_RATE: 0.06,
    ACQUIRING_RATE: 0.015,
    CUSTOMER_DELIVERY: 25,
    MAX_HISTORY_SIZE: 100,
    LOGISTIC_TIERS: [
        { maxWeight: 0.5, cost: 40 },
        { maxWeight: 1, cost: 50 },
        { maxWeight: 2, cost: 70 },
        { maxWeight: 5, cost: 120 },
        { maxWeight: 10, cost: 200 },
        { maxWeight: Infinity, cost: 300 }
    ]
};

// Кэш DOM элементов
const elements = {
    category: null,
    price: null,
    purchasePrice: null,
    deliveryCost: null,
    packagingCost: null,
    quantity: null,
    weight: null,
    length: null,
    width: null,
    height: null,
    redemptionRate: null,
    advertisingPercent: null,
    volumeValue: null,
    calculateBtn: null,
    resetBtn: null,
    clearHistoryBtn: null,
    exportBtn: null,
    exportHistoryBtn: null,
    historyBody: null
};

// Данные приложения
let tariffData = [];
let calculationHistory = [];

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    cacheDOMElements();
    setupEventListeners();
    loadCalculationHistory();
    loadExcelFile('tariffs.xlsx');
    updateVolume();
}

function cacheDOMElements() {
    elements.category = document.getElementById('category');
    elements.price = document.getElementById('price');
    elements.purchasePrice = document.getElementById('purchasePrice');
    elements.deliveryCost = document.getElementById('deliveryCost');
    elements.packagingCost = document.getElementById('packagingCost');
    elements.quantity = document.getElementById('quantity');
    elements.weight = document.getElementById('weight');
    elements.length = document.getElementById('length');
    elements.width = document.getElementById('width');
    elements.height = document.getElementById('height');
    elements.redemptionRate = document.getElementById('redemptionRate');
    elements.advertisingPercent = document.getElementById('advertisingPercent');
    elements.volumeValue = document.getElementById('volumeValue');
    elements.calculateBtn = document.getElementById('calculateBtn');
    elements.resetBtn = document.getElementById('resetBtn');
    elements.clearHistoryBtn = document.getElementById('clearHistoryBtn');
    elements.exportBtn = document.getElementById('exportBtn');
    elements.exportHistoryBtn = document.getElementById('exportHistoryBtn');
    elements.historyBody = document.getElementById('historyBody');
}

function setupEventListeners() {
    elements.calculateBtn.addEventListener('click', calculate);
    elements.resetBtn.addEventListener('click', resetForm);
    elements.clearHistoryBtn.addEventListener('click', clearHistory);
    elements.exportBtn.addEventListener('click', exportCalculation);
    elements.exportHistoryBtn.addEventListener('click', exportHistory);
    
    // Добавляем debounce для частых операций
    const debouncedUpdateVolume = debounce(updateVolume, 300);
    ['length', 'width', 'height'].forEach(id => {
        document.getElementById(id).addEventListener('input', debouncedUpdateVolume);
    });
}

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

function loadExcelFile(filename) {
    fetch(filename)
        .then(response => {
            if (!response.ok) throw new Error('Файл тарифов не найден');
            return response.arrayBuffer();
        })
        .then(data => parseExcelData(data))
        .catch(error => {
            console.error('Ошибка загрузки файла:', error);
            showNotification('Ошибка загрузки файла тарифов', 'error');
        });
}

function parseExcelData(data) {
    try {
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetNames = workbook.SheetNames;
        
        const commissionSheet = findActualCommissionSheet(sheetNames, workbook);
        
        if (!commissionSheet) {
            showNotification('Не найдена подходящая вкладка с комиссиями', 'error');
            return;
        }

        const jsonData = XLSX.utils.sheet_to_json(commissionSheet.sheet, { header: 1 });
        
        if (jsonData.length < 2) {
            throw new Error('Excel файл не содержит данных');
        }

        const headers = validateExcelHeaders(jsonData[0]);
        tariffData = jsonData.slice(1).map(row => createTariffObject(row, headers));
        
        populateCategories();
        showNotification(`Загружены тарифы из вкладки: ${commissionSheet.name}`, 'success');
    } catch (error) {
        console.error('Ошибка парсинга Excel:', error);
        showNotification('Ошибка при чтении файла тарифов', 'error');
    }
}

function validateExcelHeaders(headers) {
    const requiredHeaders = ['Категория', 'FBO до 100 руб.', 'FBO свыше 100 до 300 руб.'];
    const missingHeaders = requiredHeaders.filter(header => 
        !headers.includes(header)
    );
    
    if (missingHeaders.length > 0) {
        throw new Error(`Отсутствуют обязательные колонки: ${missingHeaders.join(', ')}`);
    }
    
    return headers;
}

function createTariffObject(row, headers) {
    const obj = {};
    headers.forEach((header, index) => {
        obj[header] = row[index] || '';
    });
    return obj;
}

function findActualCommissionSheet(sheetNames, workbook) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let actualSheet = null;
    let actualSheetDate = null;
    
    const dateRegex = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;
    
    sheetNames.forEach(sheetName => {
        if (sheetName.includes('Комиссии с') || sheetName.includes('Комиссия с')) {
            const match = sheetName.match(dateRegex);
            
            if (match) {
                const [, day, month, year] = match;
                const sheetDate = new Date(year, month - 1, day);
                sheetDate.setHours(0, 0, 0, 0);
                
                if (sheetDate <= today) {
                    if (!actualSheetDate || sheetDate > actualSheetDate) {
                        actualSheetDate = sheetDate;
                        actualSheet = {
                            name: sheetName,
                            sheet: workbook.Sheets[sheetName],
                            date: sheetDate
                        };
                    }
                }
            }
        }
    });
    
    if (!actualSheet && sheetNames.length > 0) {
        actualSheet = {
            name: sheetNames[0],
            sheet: workbook.Sheets[sheetNames[0]],
            date: null
        };
        showNotification('Используется первая вкладка (актуальная не найдена)', 'warning');
    }
    
    return actualSheet;
}

function populateCategories() {
    if (!elements.category) return;
    
    elements.category.innerHTML = '<option value="">Выберите категорию</option>';
    
    if (!tariffData || tariffData.length === 0) return;
    
    const categories = [...new Set(tariffData.map(item => item['Категория']))]
        .filter(cat => cat && cat.toString().trim())
        .sort();
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        elements.category.appendChild(option);
    });
}

function updateVolume() {
    const length = parseFloat(elements.length.value) || 0;
    const width = parseFloat(elements.width.value) || 0;
    const height = parseFloat(elements.height.value) || 0;
    
    if (length < 0 || width < 0 || height < 0) {
        showNotification('Размеры не могут быть отрицательными', 'warning');
        return;
    }
    
    const volume = (length * width * height) / 1000;
    elements.volumeValue.textContent = volume.toFixed(1);
}

function calculate() {
    const inputData = getInputData();
    
    if (!validateInputs(inputData)) return;

    const tariff = findTariffForCategory(inputData.category);
    if (!tariff) return;

    const calculationResult = performCalculations(inputData, tariff);
    displayResults(calculationResult);
    saveToHistory(inputData, calculationResult);
}

function getInputData() {
    return {
        category: elements.category.value,
        price: parseFloat(elements.price.value),
        purchasePrice: parseFloat(elements.purchasePrice.value),
        deliveryCost: parseFloat(elements.deliveryCost.value) || 0,
        packagingCost: parseFloat(elements.packagingCost.value) || 0,
        quantity: parseInt(elements.quantity.value),
        weight: parseFloat(elements.weight.value) || 1,
        redemptionRate: parseFloat(elements.redemptionRate.value) || 80,
        advertisingPercent: parseFloat(elements.advertisingPercent.value) || 0
    };
}

function validateInputs(inputData) {
    const { category, price, purchasePrice, quantity, weight, redemptionRate, advertisingPercent } = inputData;
    
    if (!category) {
        showNotification('Выберите категорию товара', 'error');
        return false;
    }
    
    if (!price || price <= 0 || price > 1000000) {
        showNotification('Введите корректную цену продажи (1 - 1 000 000 руб.)', 'error');
        return false;
    }
    
    if (!purchasePrice || purchasePrice <= 0 || purchasePrice > 1000000) {
        showNotification('Введите корректную закупочную цену (1 - 1 000 000 руб.)', 'error');
        return false;
    }
    
    if (!quantity || quantity <= 0 || quantity > 100000) {
        showNotification('Введите корректное количество (1 - 100 000 шт.)', 'error');
        return false;
    }
    
    if (weight < 0.1 || weight > 100) {
        showNotification('Введите корректный вес (0.1 - 100 кг)', 'error');
        return false;
    }
    
    if (redemptionRate < 0 || redemptionRate > 100) {
        showNotification('Введите корректный процент выкупа (0-100%)', 'error');
        return false;
    }
    
    if (advertisingPercent < 0 || advertisingPercent > 100) {
        showNotification('Введите корректный процент на рекламу (0-100%)', 'error');
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
    if (!tariff) {
        showNotification(`Не найден тариф для категории: ${category}`, 'error');
        return null;
    }
    return tariff;
}

function performCalculations(inputData, tariff) {
    const costPrice = calculateCostPrice(inputData);
    const commission = calculateCommission(tariff, inputData.price);
    const additionalCosts = calculateAdditionalCosts(inputData);
    const logistic = calculateLogisticCost(inputData.weight);
    const financials = calculateFinancials(inputData, costPrice, commission, additionalCosts, logistic);
    
    return {
        ...inputData,
        costPrice,
        commission,
        additionalCosts,
        logistic,
        ...financials
    };
}

function calculateCostPrice(inputData) {
    return inputData.purchasePrice + inputData.deliveryCost + inputData.packagingCost;
}

function calculateCommission(tariff, price) {
    const commissionKey = getCommissionKey(price);
    const commissionValue = tariff[commissionKey];
    
    if (!commissionValue) return { percent: 15, amount: price * 0.15 };
    
    const commissionPercent = parseCommissionValue(commissionValue);
    return {
        percent: commissionPercent,
        amount: price * commissionPercent / 100
    };
}

function getCommissionKey(price) {
    if (price <= 100) return 'FBO до 100 руб.';
    if (price <= 300) return 'FBO свыше 100 до 300 руб.';
    if (price <= 500) return 'FBO свыше 300 до 500 руб.';
    if (price <= 1500) return 'FBO свыше 500 до 1500 руб.';
    return 'FBO свыше 1500 руб.';
}

function parseCommissionValue(value) {
    const commissionStr = value.toString()
        .replace('%', '')
        .replace(',', '.')
        .trim();
    
    return parseFloat(commissionStr) || 15;
}

function calculateAdditionalCosts(inputData) {
    const acquiringAmount = inputData.price * APP_CONFIG.ACQUIRING_RATE;
    const advertisingAmount = inputData.price * inputData.advertisingPercent / 100;
    
    return {
        acquiringAmount,
        advertisingAmount,
        total: acquiringAmount + advertisingAmount
    };
}

function calculateLogisticCost(weight) {
    const tier = APP_CONFIG.LOGISTIC_TIERS.find(t => weight <= t.maxWeight);
    const logisticCost = tier ? tier.cost : 300;
    
    return {
        logisticCost,
        customerDelivery: APP_CONFIG.CUSTOMER_DELIVERY,
        total: logisticCost + APP_CONFIG.CUSTOMER_DELIVERY
    };
}

function calculateFinancials(inputData, costPrice, commission, additionalCosts, logistic) {
    const totalOzonExpenses = commission.amount + additionalCosts.total + logistic.total;
    const revenueAfterOzon = inputData.price - totalOzonExpenses;
    const tax = revenueAfterOzon * APP_CONFIG.TAX_RATE;
    const profitPerUnit = revenueAfterOzon - costPrice - tax;
    const margin = (profitPerUnit / inputData.price) * 100;
    
    const expectedSales = Math.round(inputData.quantity * inputData.redemptionRate / 100);
    const batchProfit = profitPerUnit * expectedSales;

    return {
        totalOzonExpenses,
        revenueAfterOzon,
        tax,
        profitPerUnit,
        margin,
        expectedSales,
        batchProfit
    };
}

function displayResults(results) {
    const formatter = new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });

    document.getElementById('resultPurchase').textContent = `${formatter.format(results.purchasePrice)} ₽`;
    document.getElementById('resultDelivery').textContent = `${formatter.format(results.deliveryCost)} ₽`;
    document.getElementById('resultPackaging').textContent = `${formatter.format(results.packagingCost)} ₽`;
    document.getElementById('resultCostPrice').textContent = `${formatter.format(results.costPrice)} ₽`;
    
    document.getElementById('resultCommission').textContent = 
        `${formatter.format(results.commission.amount)} ₽ (${results.commission.percent.toFixed(2)}%)`;
    document.getElementById('resultAcquiring').textContent = `${formatter.format(results.additionalCosts.acquiringAmount)} ₽`;
    document.getElementById('resultAdvertising').textContent = `${formatter.format(results.additionalCosts.advertisingAmount)} ₽`;
    
    document.getElementById('resultLogistic').textContent = `${formatter.format(results.logistic.logisticCost)} ₽`;
    document.getElementById('resultCustomerDelivery').textContent = `${formatter.format(results.logistic.customerDelivery)} ₽`;
    document.getElementById('resultTotalLogistic').textContent = `${formatter.format(results.logistic.total)} ₽`;
    
    document.getElementById('resultRevenue').textContent = `${formatter.format(results.price)} ₽`;
    document.getElementById('resultTotalExpenses').textContent = `${formatter.format(results.totalOzonExpenses)} ₽`;
    document.getElementById('resultTax').textContent = `${formatter.format(results.tax)} ₽`;
    document.getElementById('resultProfitPerUnit').textContent = `${formatter.format(results.profitPerUnit)} ₽`;
    document.getElementById('resultMargin').textContent = `${results.margin.toFixed(1)}%`;
    document.getElementById('resultBatchProfit').textContent = `${formatter.format(results.batchProfit)} ₽`;
}

function saveToHistory(inputData, calculationResult) {
    const calculation = {
        id: Date.now(),
        category: inputData.category,
        price: inputData.price,
        purchasePrice: inputData.purchasePrice,
        profitPerUnit: Math.round(calculationResult.profitPerUnit),
        quantity: inputData.quantity,
        batchProfit: Math.round(calculationResult.batchProfit),
        date: new Date().toLocaleString('ru-RU')
    };
    
    calculationHistory.unshift(calculation);
    
    // Ограничиваем размер истории
    if (calculationHistory.length > APP_CONFIG.MAX_HISTORY_SIZE) {
        calculationHistory = calculationHistory.slice(0, APP_CONFIG.MAX_HISTORY_SIZE);
    }
    
    try {
        localStorage.setItem('calculationHistory', JSON.stringify(calculationHistory));
        renderHistory();
        showNotification('Расчет сохранен в историю', 'success');
    } catch (error) {
        console.error('Ошибка сохранения в localStorage:', error);
        showNotification('Ошибка сохранения истории', 'error');
    }
}

function loadCalculationHistory() {
    try {
        const saved = localStorage.getItem('calculationHistory');
        if (saved) {
            calculationHistory = JSON.parse(saved);
            renderHistory();
        }
    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
        calculationHistory = [];
        showNotification('Ошибка загрузки истории расчетов', 'error');
    }
}

function renderHistory() {
    if (!elements.historyBody) return;
    
    elements.historyBody.innerHTML = '';
    
    if (calculationHistory.length === 0) {
        elements.historyBody.innerHTML = 
            '<tr><td colspan="6" style="text-align: center; color: #666;">История расчетов пуста</td></tr>';
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
        elements.historyBody.appendChild(row);
    });
}

function clearHistory() {
    if (calculationHistory.length === 0) {
        showNotification('История уже пуста', 'info');
        return;
    }
    
    if (confirm('Очистить всю историю расчетов?')) {
        calculationHistory = [];
        try {
            localStorage.removeItem('calculationHistory');
            renderHistory();
            showNotification('История очищена', 'success');
        } catch (error) {
            console.error('Ошибка очистки истории:', error);
            showNotification('Ошибка очистки истории', 'error');
        }
    }
}

function resetForm() {
    elements.price.value = '';
    elements.purchasePrice.value = '';
    elements.deliveryCost.value = '';
    elements.packagingCost.value = '';
    elements.quantity.value = '1';
    elements.weight.value = '';
    elements.length.value = '';
    elements.width.value = '';
    elements.height.value = '';
    elements.redemptionRate.value = '80';
    elements.advertisingPercent.value = '5';
    elements.volumeValue.textContent = '0';
    
    showNotification('Форма сброшена', 'info');
}

function exportCalculation() {
    if (calculationHistory.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    try {
        const data = [calculationHistory[0]];
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Расчет');
        XLSX.writeFile(workbook, `calculation_${new Date().getTime()}.xlsx`);
        showNotification('Расчет экспортирован', 'success');
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        showNotification('Ошибка при экспорте расчета', 'error');
    }
}

function exportHistory() {
    if (calculationHistory.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    try {
        const worksheet = XLSX.utils.json_to_sheet(calculationHistory);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'История расчетов');
        XLSX.writeFile(workbook, `history_${new Date().getTime()}.xlsx`);
        showNotification('История экспортирована', 'success');
    } catch (error) {
        console.error('Ошибка экспорта истории:', error);
        showNotification('Ошибка при экспорте истории', 'error');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    
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
        transition: transform 0.3s ease, opacity 0.3s ease;
        transform: translateX(100%);
        opacity: 0;
    `;
    
    const typeStyles = {
        success: '#27ae60',
        error: '#e74c3c',
        warning: '#f39c12',
        info: '#3498db'
    };
    
    notification.style.background = typeStyles[type] || typeStyles.info;
    
    document.body.appendChild(notification);
    
    // Анимация появления
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    });
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}
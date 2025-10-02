function calculate() {
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
    const acquiringAmount = price * 0.015;
    const advertisingAmount = price * advertisingPercent / 100;
    
    // Расчет логистики по объему
    const volume = getVolume();
    const logisticCost = calculateLogisticByVolume(volume);
    const customerDelivery = 25;
    const totalLogistic = logisticCost + customerDelivery;

    // Итоговые расчеты
    const totalOzonExpenses = commissionAmount + acquiringAmount + advertisingAmount + totalLogistic;
    const revenueAfterOzon = price - totalOzonExpenses;
    const tax = revenueAfterOzon * 0.06;
    const profitPerUnit = revenueAfterOzon - costPrice - tax;
    const margin = (profitPerUnit / price) * 100;
    
    const expectedSales = Math.round(quantity * redemptionRate / 100);
    const batchProfit = profitPerUnit * expectedSales;

    displayResults(
        purchasePrice, deliveryCost, packagingCost, costPrice,
        commissionAmount, commissionPercent, acquiringAmount, advertisingAmount,
        logisticCost, customerDelivery, totalLogistic,
        price, totalOzonExpenses, tax, profitPerUnit, margin, batchProfit
    );

    saveToHistory(category, price, purchasePrice, profitPerUnit, quantity, batchProfit);
}

function getVolume() {
    const length = parseFloat(document.getElementById('length').value) || 0;
    const width = parseFloat(document.getElementById('width').value) || 0;
    const height = parseFloat(document.getElementById('height').value) || 0;
    return (length * width * height) / 1000;
}

function calculateLogisticByVolume(volume) {
    if (!volumeTariffs || volumeTariffs.length === 0) {
        showNotification('Тарифы логистики по объему не загружены. Используется расчет по весу.', 'warning');
        return calculateLogisticByWeight(volume); // fallback на расчет по весу
    }

    // Находим подходящий тариф для объема
    let applicableTariff = volumeTariffs[0]?.tariff || 0;
    
    for (const tariff of volumeTariffs) {
        if (volume >= tariff.lowerBound) {
            applicableTariff = tariff.tariff;
        } else {
            break;
        }
    }
    
    return applicableTariff;
}

function calculateLogisticByWeight(weight) {
    // Резервная функция расчета по весу (на случай если не загружены тарифы по объему)
    if (weight <= 0.5) return 40;
    if (weight <= 1) return 50;
    if (weight <= 2) return 70;
    if (weight <= 5) return 120;
    if (weight <= 10) return 200;
    return 300;
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

function displayResults(
    purchasePrice, deliveryCost, packagingCost, costPrice,
    commissionAmount, commissionPercent, acquiringAmount, advertisingAmount,
    logisticCost, customerDelivery, totalLogistic,
    price, totalOzonExpenses, tax, profitPerUnit, margin, batchProfit
) {
    document.getElementById('resultPurchase').textContent = `${purchasePrice.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultDelivery').textContent = `${deliveryCost.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultPackaging').textContent = `${packagingCost.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultCostPrice').textContent = `${costPrice.toLocaleString('ru-RU')} ₽`;
    
    document.getElementById('resultCommission').textContent = 
        `${commissionAmount.toLocaleString('ru-RU')} ₽ (${commissionPercent.toFixed(2)}%)`;
    document.getElementById('resultAcquiring').textContent = `${acquiringAmount.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultAdvertising').textContent = `${advertisingAmount.toLocaleString('ru-RU')} ₽`;
    
    document.getElementById('resultLogistic').textContent = `${logisticCost.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultCustomerDelivery').textContent = `${customerDelivery.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultTotalLogistic').textContent = `${totalLogistic.toLocaleString('ru-RU')} ₽`;
    
    document.getElementById('resultRevenue').textContent = `${price.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultTotalExpenses').textContent = `${totalOzonExpenses.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultTax').textContent = `${tax.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultProfitPerUnit').textContent = `${profitPerUnit.toLocaleString('ru-RU')} ₽`;
    document.getElementById('resultMargin').textContent = `${margin.toFixed(1)}%`;
    document.getElementById('resultBatchProfit').textContent = `${batchProfit.toLocaleString('ru-RU')} ₽`;
}
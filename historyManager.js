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
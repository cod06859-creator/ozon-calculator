function updateVolume() {
    const volume = getVolume();
    document.getElementById('volumeValue').textContent = volume.toFixed(1);
    
    // Показываем расчетный тариф логистики, если тарифы загружены
    if (volumeTariffs && volumeTariffs.length > 0) {
        const logisticCost = calculateLogisticByVolume(volume);
        // Можно добавить отображение предварительного расчета, если нужно
        // Например: показать всплывающую подсказку с расчетным тарифом
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
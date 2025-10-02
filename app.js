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

// Re-export functions that need to be globally available
window.updateVolume = updateVolume;
window.calculate = calculate;
window.resetForm = resetForm;
window.clearHistory = clearHistory;
window.exportCalculation = exportCalculation;
window.exportHistory = exportHistory;
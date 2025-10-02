const CONSTANTS = {
    EXCEL_FILE: 'tariffs.xlsx',
    ELEMENT_IDS: {
        CALCULATE_BTN: 'calculateBtn',
        RESET_BTN: 'resetBtn',
        CLEAR_HISTORY_BTN: 'clearHistoryBtn',
        EXPORT_BTN: 'exportBtn',
        EXPORT_HISTORY_BTN: 'exportHistoryBtn',
        LENGTH: 'length',
        WIDTH: 'width',
        HEIGHT: 'height',
        VOLUME: 'volume'
    },
    DECIMAL_PLACES: 2,
    MAX_DIMENSION: 1000000
};

let tariffData = [];
let calculationHistory = [];

document.addEventListener('DOMContentLoaded', function() {
    try {
        initializeApp();
        setupEventListeners();
        loadCalculationHistory();
    } catch (error) {
        console.error('Initialization failed:', error);
    }
});

function initializeApp() {
    try {
        loadExcelFile(CONSTANTS.EXCEL_FILE);
        updateVolume();
    } catch (error) {
        console.error('App initialization failed:', error);
    }
}

function setupEventListeners() {
    try {
        const ids = CONSTANTS.ELEMENT_IDS;
        getElement(ids.CALCULATE_BTN).addEventListener('click', calculate);
        getElement(ids.RESET_BTN).addEventListener('click', resetForm);
        getElement(ids.CLEAR_HISTORY_BTN).addEventListener('click', clearHistory);
        getElement(ids.EXPORT_BTN).addEventListener('click', exportCalculation);
        getElement(ids.EXPORT_HISTORY_BTN).addEventListener('click', exportHistory);
        
        [ids.LENGTH, ids.WIDTH, ids.HEIGHT].forEach(id => {
            getElement(id).addEventListener('input', updateVolume);
        });
    } catch (error) {
        console.error('Event listener setup failed:', error);
    }
}

function getElement(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Element with id '${id}' not found`);
    return element;
}

function updateVolume() {
    try {
        const ids = CONSTANTS.ELEMENT_IDS;
        const length = parseFloat(getElement(ids.LENGTH).value) || 0;
        const width = parseFloat(getElement(ids.WIDTH).value) || 0;
        const height = parseFloat(getElement(ids.HEIGHT).value) || 0;
        
        if (length < 0 || width < 0 || height < 0) {
            throw new Error('Dimensions cannot be negative');
        }
        
        if (length > CONSTANTS.MAX_DIMENSION || width > CONSTANTS.MAX_DIMENSION || height > CONSTANTS.MAX_DIMENSION) {
            throw new Error('Dimensions too large');
        }
        
        const volume = length * width * height;
        getElement(ids.VOLUME).textContent = volume.toFixed(CONSTANTS.DECIMAL_PLACES);
    } catch (error) {
        console.error('Volume calculation failed:', error);
    }
}

function calculate() {
    try {
        const ids = CONSTANTS.ELEMENT_IDS;
        const length = parseFloat(getElement(ids.LENGTH).value) || 0;
        const width = parseFloat(getElement(ids.WIDTH).value) || 0;
        const height = parseFloat(getElement(ids.HEIGHT).value) || 0;
        const volume = length * width * height;
        
        if (!tariffData.length) {
            throw new Error('Tariff data not loaded');
        }
        
        const tariff = findTariff(volume);
        const cost = volume * tariff.rate;
        
        const calculation = {
            timestamp: new Date().toISOString(),
            length: length,
            width: width,
            height: height,
            volume: volume,
            tariff: tariff.name,
            rate: tariff.rate,
            cost: cost
        };
        
        calculationHistory.push(calculation);
        saveCalculationHistory();
        displayResult(calculation);
        
    } catch (error) {
        console.error('Calculation failed:', error);
        alert(error.message);
    }
}

function findTariff(volume) {
    for (const tariff of tariffData) {
        if (volume >= tariff.min && volume <= tariff.max) {
            return tariff;
        }
    }
    throw new Error('No suitable tariff found for volume: ' + volume);
}

function displayResult(calculation) {
    const resultElement = getElement('result');
    resultElement.innerHTML = `
        <h3>Calculation Result</h3>
        <p>Volume: ${calculation.volume.toFixed(CONSTANTS.DECIMAL_PLACES)}</p>
        <p>Tariff: ${calculation.tariff}</p>
        <p>Rate: $${calculation.rate.toFixed(CONSTANTS.DECIMAL_PLACES)}</p>
        <p><strong>Total Cost: $${calculation.cost.toFixed(CONSTANTS.DECIMAL_PLACES)}</strong></p>
    `;
}

function resetForm() {
    try {
        const ids = CONSTANTS.ELEMENT_IDS;
        getElement(ids.LENGTH).value = '';
        getElement(ids.WIDTH).value = '';
        getElement(ids.HEIGHT).value = '';
        getElement(ids.VOLUME).textContent = '0';
        getElement('result').innerHTML = '';
    } catch (error) {
        console.error('Form reset failed:', error);
    }
}

function clearHistory() {
    try {
        calculationHistory = [];
        localStorage.removeItem('calculationHistory');
        alert('History cleared successfully');
    } catch (error) {
        console.error('History clearance failed:', error);
    }
}

function saveCalculationHistory() {
    try {
        localStorage.setItem('calculationHistory', JSON.stringify(calculationHistory));
    } catch (error) {
        console.error('History save failed:', error);
    }
}

function loadCalculationHistory() {
    try {
        const saved = localStorage.getItem('calculationHistory');
        if (saved) {
            calculationHistory = JSON.parse(saved);
        }
    } catch (error) {
        console.error('History load failed:', error);
    }
}

function exportCalculation() {
    try {
        if (calculationHistory.length === 0) {
            alert('No calculations to export');
            return;
        }
        
        const lastCalculation = calculationHistory[calculationHistory.length - 1];
        const data = JSON.stringify(lastCalculation, null, 2);
        downloadFile(data, 'calculation.json');
        
    } catch (error) {
        console.error('Export failed:', error);
    }
}

function exportHistory() {
    try {
        if (calculationHistory.length === 0) {
            alert('No history to export');
            return;
        }
        
        const data = JSON.stringify(calculationHistory, null, 2);
        downloadFile(data, 'calculation_history.json');
        
    } catch (error) {
        console.error('History export failed:', error);
    }
}

function downloadFile(data, filename) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Глобальный реэкспорт
window.updateVolume = updateVolume;
window.calculate = calculate;
window.resetForm = resetForm;
window.clearHistory = clearHistory;
window.exportCalculation = exportCalculation;
window.exportHistory = exportHistory;
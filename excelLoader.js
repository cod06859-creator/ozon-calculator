let volumeTariffs = [];

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
        const sheetNames = workbook.SheetNames;
        
        // Находим актуальную вкладку на основе дат
        const commissionSheet = findActualCommissionSheet(sheetNames, workbook);
        
        if (!commissionSheet) {
            showNotification('Не найдена подходящая вкладка с комиссиями', 'error');
            return;
        }

        const jsonData = XLSX.utils.sheet_to_json(commissionSheet.sheet, { header: 1 });
        
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
            showNotification(`Загружены тарифы из вкладки: ${commissionSheet.name}`, 'success');
        }

        // Парсим вкладку "Справочник" для тарифов логистики по объему
        parseReferenceSheet(workbook);

    } catch (error) {
        showNotification('Ошибка при чтении файла тарифов', 'error');
    }
}

function parseReferenceSheet(workbook) {
    try {
        const referenceSheet = workbook.Sheets['Справочник'];
        if (!referenceSheet) {
            showNotification('Не найдена вкладка "Справочник"', 'warning');
            return;
        }

        const jsonData = XLSX.utils.sheet_to_json(referenceSheet, { header: 1 });
        
        // Ищем строку с заголовками "Нижняя граница объёма (л)" и "Тариф, ₽"
        let headersIndex = -1;
        let volumeCol = -1;
        let tariffCol = -1;

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (Array.isArray(row)) {
                for (let j = 0; j < row.length; j++) {
                    const cell = row[j];
                    if (typeof cell === 'string') {
                        if (cell.includes('Нижняя граница объёма') || cell.includes('объёма (л)')) {
                            volumeCol = j;
                        }
                        if (cell.includes('Тариф') && cell.includes('₽')) {
                            tariffCol = j;
                        }
                    }
                }
                
                if (volumeCol !== -1 && tariffCol !== -1) {
                    headersIndex = i;
                    break;
                }
            }
        }

        if (headersIndex === -1) {
            showNotification('Не найдены заголовки тарифов логистики в справочнике', 'warning');
            return;
        }

        // Парсим данные тарифов
        volumeTariffs = [];
        for (let i = headersIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (Array.isArray(row) && row[volumeCol] !== undefined && row[tariffCol] !== undefined) {
                const lowerBound = parseFloat(String(row[volumeCol]).replace(',', '.').trim());
                const tariff = parseFloat(String(row[tariffCol]).replace(',', '.').trim());
                
                if (!isNaN(lowerBound) && !isNaN(tariff)) {
                    volumeTariffs.push({
                        lowerBound: lowerBound,
                        tariff: tariff
                    });
                }
            }
        }

        // Сортируем по возрастанию нижней границы
        volumeTariffs.sort((a, b) => a.lowerBound - b.lowerBound);

        console.log('Загружены тарифы логистики по объему:', volumeTariffs);
        showNotification(`Загружено ${volumeTariffs.length} тарифов логистики по объему`, 'success');

    } catch (error) {
        console.error('Ошибка при парсинге справочника:', error);
        showNotification('Ошибка при загрузке тарифов логистики', 'warning');
    }
}

function findActualCommissionSheet(sheetNames, workbook) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let actualSheet = null;
    let actualSheetDate = null;
    
    // Регулярное выражение для поиска дат в формате DD.MM.YYYY
    const dateRegex = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;
    
    sheetNames.forEach(sheetName => {
        // Ищем вкладки, которые содержат "Комиссии с" или "Комиссия с"
        if (sheetName.includes('Комиссии с') || sheetName.includes('Комиссия с')) {
            const match = sheetName.match(dateRegex);
            
            if (match) {
                const [, day, month, year] = match;
                // Создаем дату из найденных компонентов (месяц в JS от 0 до 11)
                const sheetDate = new Date(year, month - 1, day);
                sheetDate.setHours(0, 0, 0, 0);
                
                // Проверяем, что дата вкладки не превышает текущую дату
                if (sheetDate <= today) {
                    // Выбираем самую актуальную вкладку (с самой поздней датой)
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
    
    // Если не нашли подходящую вкладку, используем первую
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

// Экспортируем глобальные переменные
window.tariffData = tariffData;
window.volumeTariffs = volumeTariffs;
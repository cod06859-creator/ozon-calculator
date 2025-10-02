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
    } catch (error) {
        showNotification('Ошибка при чтении файла тарифов', 'error');
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
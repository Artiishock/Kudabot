const cityManager = require('./utils/cityManager');
const placeManager = require('./utils/placeManager');
const categoryManager = require('./utils/categoryManager');
const fileManager = require('./utils/fileManager');
const photoManager = require('./utils/photoManager');
const PhotoDownloader = require('./utils/photoDownloader');
const firebaseStorage = require('./utils/firebaseStorage');
const firebaseDatabase = require('./utils/firebaseDatabase');
const axios = require('axios');
const adsManager = require('./utils/adsManager');

const { initializeAllManagers } = require('./firebaseInitializer');

class CityGuideBot {
  constructor(telegramBot, adminIds = [], botToken) {
    this.bot = telegramBot;
    this.adminIds = adminIds;
    this.botToken = botToken;

  this.fieldLabels = {
    name: 'название',
    address: 'адрес',
    working_hours: 'время работы',
    average_price: 'средний чек',
    description: 'описание',
    website: 'сайт',
    phone: 'телефон',
    map_url: 'ссылка на карту',
    category_id: 'категория',
    social_links: 'социальные сети',
    latitude: 'широта',
    longitude: 'долгота',
    google_place_id: 'Google Place ID'
  };

  // ✅ НОВОЕ: Maps для дедупликации
    this.processingCallbacks = new Map();
    this.processingMessages = new Map();
    this.processingCommands = new Map();
    this.processingPhotos = new Map();
    this.showingMenu = new Map();
    this.lastMessages = new Map();
    
    // ✅ НОВОЕ: Очистка старых записей каждые 30 секунд
    setInterval(() => {
      const now = Date.now();
      
      // Очищаем старые processingMessages (старше 10 секунд)
      for (const [key, timestamp] of this.processingMessages.entries()) {
        if (now - timestamp > 10000) {
          this.processingMessages.delete(key);
        }
      }
      
      // Очищаем старые lastMessages (старше 60 секунд)
      for (const [key, timestamp] of this.lastMessages.entries()) {
        if (now - timestamp > 60000) {
          this.lastMessages.delete(key);
        }
      }
      
      // Очищаем старые processingCallbacks (старше 30 секунд)
      for (const [key, timestamp] of this.processingCallbacks.entries()) {
        if (now - timestamp > 30000) {
          this.processingCallbacks.delete(key);
        }
      }
    }, 30000);


  this.adminSessions = new Map();

    this.adminSessions = new Map();
    // Initialize ALL required Maps
    this.userStates = new Map();
    this.photoMessages = new Map();
    this.userPhotos = new Map();
    this.lastBotMessages = new Map();
    this.adminSessions = new Map();
    this.adsManager = adsManager;
    this.firebaseDB = firebaseDatabase;
    this.startCleanupInterval();
    
// ✅ ДОБАВЬТЕ ЭТО СРАЗУ ПОСЛЕ ИНИЦИАЛИЗАЦИИ FIREBASE DB
// Инициализируем менеджеры с Firebase
const { initializeAllManagers } = require('./firebaseInitializer');
setTimeout(async () => {
  try {
    const initialized = await initializeAllManagers();
    if (initialized) {
      console.log('✅ Все менеджеры работают через Firebase');
      
      // Фоновая синхронизация данных
      setTimeout(async () => {
        await this.syncLocalDataToFirebase();
      }, 5000);
    } else {
      console.log('⚠️ Менеджеры работают в локальном режиме');
    }
  } catch (error) {
    console.error('❌ Ошибка инициализации менеджеров:', error);
  }
}, 1000);



    // ✅ Проверка Firebase Database
    console.log('🔧 Статус Firebase Database:', 
      this.firebaseDB && this.firebaseDB.initialized ? '✅ Инициализирована' : '❌ Не инициализирована');
    
    // Инициализация Firebase Storage с обработкой ошибок
    try {
      const FirebaseStorage = require('./utils/firebaseStorage');
      this.firebaseStorage = new FirebaseStorage();
      
      console.log('🔧 Статус Firebase Storage:', 
        this.firebaseStorage.initialized ? '✅ Инициализирован' : '❌ Не инициализирован');
      
    } catch (error) {
      console.error('❌ Не удалось загрузить Firebase Storage:', error.message);
      this.firebaseStorage = null;
    }
    
    
    // Инициализация PhotoDownloader (оставляем для обратной совместимости)
    try {
      this.photoDownloader = new PhotoDownloader(botToken);
    } catch (error) {
      console.error('❌ Не удалось инициализировать PhotoDownloader:', error.message);
      this.photoDownloader = null;
    }
    (async () => {
  if (firebaseDatabase) {
    console.log('🔥 Проверяю Firebase Database:');
    console.log('  - initialized:', firebaseDatabase.initialized);
    console.log('  - db:', firebaseDatabase.db ? '✅ Есть' : '❌ Нет');
    console.log('  - available methods:', Object.keys(firebaseDatabase).filter(key => typeof firebaseDatabase[key] === 'function'));
    
    if (firebaseDatabase.db) {
      // Тестовый запрос
      try {
        const testRef = firebaseDatabase.db.ref('test_connection');
        await testRef.set({
          timestamp: Date.now(),
          message: 'Test connection from bot'
        });
        console.log('✅ Тестовый запрос к Firebase успешен');
      } catch (error) {
        console.error('❌ Тестовый запрос к Firebase не удался:', error.message);
      }
    }
  }
})();
    // Привязываем методы
    this.setupHandlers = this.setupHandlers.bind(this);
    this.isUserAdmin = this.isUserAdmin.bind(this);
    this.handlePhotoMessage = this.handlePhotoMessage.bind(this);
    this.handleAdminCityAction = this.handleAdminCityAction.bind(this);
    
    this.setupHandlers();
    console.log('✅ Bot initialized');
  }

 async checkFirebaseStatus() {
    console.log('🔍 Проверяю статус Firebase...');
    
    try {
      // Проверяем, инициализированы ли менеджеры с Firebase
      const managers = [cityManager, placeManager, categoryManager, adsManager];
      let firebaseReady = true;
      
      for (const manager of managers) {
        if (manager.firebaseDB && !manager.firebaseDB.initialized) {
          console.error(`❌ Менеджер ${manager.constructor.name} не подключен к Firebase`);
          firebaseReady = false;
        }
      }
      
      if (firebaseReady) {
        console.log('✅ Все менеджеры подключены к Firebase');
        
        // 🔄 Запускаем фоновую синхронизацию при старте
        setTimeout(async () => {
          try {
            console.log('🔄 Запускаю фоновую синхронизацию данных...');
            await this.firebaseDB.forceSync();
            console.log('✅ Синхронизация завершена');
          } catch (syncError) {
            console.error('❌ Ошибка синхронизации:', syncError.message);
          }
        }, 3000);
      }
      
    } catch (error) {
      console.error('❌ Ошибка проверки статуса Firebase:', error);
    }
  }

    // 🔥 ТРЕТЬЕ ИЗМЕНЕНИЕ: Обновляем методы работы с городами для Firebase-first
  // async getCityKey(cityName) {
  //   console.log(`🔑 [getCityKey] Начинаю обработку: "${cityName}"`);
    
  //   if (!cityName || typeof cityName !== 'string') {
  //     console.warn('⚠️ [getCityKey] Неверное название города:', cityName);
  //     return 'unknown';
  //   }
    
  //   console.log(`🔍 [DEBUG getCityKey] Входное значение: "${cityName}"`);
    
  //   const cleaned = cityName.trim();
  //   if (cleaned.length === 0) {
  //     return 'unknown';
  //   }
    
  //   // Используем метод генерации ID из Firebase
  //   if (this.firebaseDB && this.firebaseDB.generateCityId) {
  //     return this.firebaseDB.generateCityId(cleaned);
  //   }
    
  //   // Fallback на старую логику
  //   const translitMap = {
  //     'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
  //     'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i',
  //     'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
  //     'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
  //     'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
  //     'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
  //     'э': 'e', 'ю': 'yu', 'я': 'ya',
  //     ' ': '_', '-': '_', ',': '', '.': '', '!': '', '?': '',
  //     '(': '', ')': '', '[': '', ']': '', '{': '', '}': '',
  //     ':': '_', ';': '_'
  //   };
    
  //   let key = '';
  //   for (let i = 0; i < cleaned.length; i++) {
  //     const char = cleaned[i].toLowerCase();
  //     if (translitMap[char] !== undefined) {
  //       key += translitMap[char];
  //     } else if (char.match(/[a-z0-9]/)) {
  //       key += char;
  //     } else {
  //       key += '_';
  //     }
  //   }
    
  //   key = key.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    
  //   if (key.length === 0) {
  //     key = 'city_' + cleaned.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 10);
  //   }
    
  //   const result = key.substring(0, 30);
  //   console.log(`🔍 [DEBUG getCityKey] Результат: "${result}"`);
    
  //   return result;
  // }

async syncLocalDataToFirebase() {
  try {
    console.log('🔄 Начинаю синхронизацию локальных данных с Firebase...');
    
    if (!this.firebaseDB || !this.firebaseDB.initialized) {
      console.log('⚠️ Firebase недоступна, пропускаю синхронизацию');
      return;
    }
    
    // Синхронизация городов
    console.log('🏙️ Синхронизирую города...');
    const localCities = await cityManager.getAllCities();
    for (const city of localCities) {
      await this.firebaseDB.syncCity(city);
    }
    
    // Синхронизация категорий
    console.log('📁 Синхронизирую категории...');
    const categories = await categoryManager.getAllCategories();
    for (const category of categories) {
      await this.firebaseDB.syncCategory(category);
    }
    
    // Синхронизация мест
    console.log('📍 Синхронизирую места...');
    for (const city of localCities) {
      const places = await placeManager.getPlacesByCity(city);
      for (const place of places) {
        await this.firebaseDB.syncPlace(city, place);
      }
    }
    
    // Синхронизация рекламы
    console.log('📢 Синхронизирую рекламу...');
    const ads = await adsManager.getAllAds();
    for (const ad of ads) {
      await this.firebaseDB.syncAd(ad);
    }
    
    console.log('✅ Синхронизация завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
  }
}

  // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============
getCityKey(cityName) {
  console.log(`🔑 [getCityKey] Начинаю обработку: "${cityName}"`);
  
  if (!cityName || typeof cityName !== 'string') {
    console.warn('⚠️ [getCityKey] Неверное название города:', cityName);
    return 'unknown';
  }
    
  const cleaned = cityName.trim();
  if (cleaned.length === 0) {
    return 'unknown';
  }
  
  // Простая транслитерация для русских букв
  const translitMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
    'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i',
    'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
    'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
    'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
    'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
    'э': 'e', 'ю': 'yu', 'я': 'ya',
    // ✅ ДОБАВЬТЕ БОЛЬШИЕ БУКВЫ
    'А': 'a', 'Б': 'b', 'В': 'v', 'Г': 'g', 'Д': 'd',
    'Е': 'e', 'Ё': 'e', 'Ж': 'zh', 'З': 'z', 'И': 'i',
    'Й': 'y', 'К': 'k', 'Л': 'l', 'М': 'm', 'Н': 'n',
    'О': 'o', 'П': 'p', 'Р': 'r', 'С': 's', 'Т': 't',
    'У': 'u', 'Ф': 'f', 'Х': 'h', 'Ц': 'ts', 'Ч': 'ch',
    'Ш': 'sh', 'Щ': 'sch', 'Ъ': '', 'Ы': 'y', 'Ь': '',
    'Э': 'e', 'Ю': 'yu', 'Я': 'ya',
    ' ': '_', '-': '_', ',': '', '.': '_', '!': '', '?': '',
    '(': '', ')': '', '[': '', ']': '', '{': '', '}': '',
    ':': '_', ';': '_'
  };
  
  let key = '';
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const lowerChar = char.toLowerCase();
    
    if (translitMap[char] !== undefined) {
      key += translitMap[char];
    } else if (translitMap[lowerChar] !== undefined) {
      key += translitMap[lowerChar];
    } else if (char.match(/[a-zA-Z0-9]/)) {
      key += lowerChar;
    } else {
      key += '_';
    }
  }
  
  // Убираем множественные подчеркивания
  key = key.replace(/_+/g, '_');
  
  // Убираем подчеркивания в начале и конце
  key = key.replace(/^_+|_+$/g, '');
  
  // Если пусто - создаем простой ключ
  if (key.length === 0) {
    console.warn(`⚠️ [getCityKey] Получился пустой ключ для "${cityName}"`);
    key = 'city_' + Date.now();
  }
  
  // Ограничиваем длину
  const result = key.substring(0, 50);
  console.log(`🔑 [getCityKey] Результат для "${cityName}": "${result}"`);
  
  return result;
}

  // Получает название города по ключу
async getCityNameFromKey(cityKey) {
  try {
    if (!cityKey || cityKey.trim() === '') {
      console.warn('⚠️ Получен пустой ключ города');
      return '';
    }
    
    console.log(`🔍 Ищу город по ключу: "${cityKey}"`);
    
    // 🔥 ПРИОРИТЕТ FIREBASE: сначала пробуем получить из Firebase
    if (this.firebaseDB && this.firebaseDB.initialized) {
      try {
        const cityName = await this.firebaseDB.getCityNameByKey(cityKey);
        if (cityName) {
          console.log(`✅ [FIREBASE] Найден город: "${cityName}"`);
          return cityName;
        }
      } catch (firebaseError) {
        console.error('❌ Ошибка Firebase при поиске города:', firebaseError.message);
      }
    }
    
    // ⚠️ FALLBACK: локальные файлы
    const cities = await cityManager.getAllCities();
    console.log('🏙️ Все города из локальных файлов:', cities);
    
    for (const city of cities) {
      const currentKey = this.getCityKey(city);
      if (currentKey === cityKey) {
        console.log(`✅ Найден город по ключу "${cityKey}": "${city}"`);
        return city;
      }
    }
    
    for (const city of cities) {
      const currentKey = this.getCityKey(city);
      if (currentKey.includes(cityKey) || cityKey.includes(currentKey)) {
        console.log(`✅ Найден город по частичному совпадению ключа "${cityKey}": "${city}"`);
        return city;
      }
    }
    
    const normalizedKey = cityKey.toLowerCase().replace(/_/g, ' ');
    for (const city of cities) {
      if (city.toLowerCase().includes(normalizedKey) || normalizedKey.includes(city.toLowerCase())) {
        console.log(`✅ Найден город по названию "${cityKey}": "${city}"`);
        return city;
      }
    }
    
    console.warn(`⚠️ Город по ключу "${cityKey}" не найден!`);
    return cityKey.replace(/_/g, ' ');
    
  } catch (error) {
    console.error(`❌ Ошибка при поиске города по ключу "${cityKey}":`, error);
    return cityKey.replace(/_/g, ' ');
  }
}

  // Метод для очистки callback_data в inline_keyboard
 cleanInlineKeyboard(markup) {
  if (!markup || !markup.inline_keyboard) return;
  
  for (const row of markup.inline_keyboard) {
    for (const button of row) {
      if (button.callback_data) {
        // Очищаем callback_data от недопустимых символов
        button.callback_data = this.cleanCallbackData(button.callback_data);
        
        // Убеждаемся, что длина не превышает 64 байта
        if (button.callback_data.length > 64) {
          console.warn(`⚠️ Callback_data слишком длинный: ${button.callback_data.length}, укорачиваю`);
          // Сохраняем первые 3 части и укорачиваем последнюю
          const parts = button.callback_data.split(':');
          if (parts.length > 3) {
            const lastPart = parts[parts.length - 1];
            if (lastPart.length > 20) {
              parts[parts.length - 1] = lastPart.substring(0, 20);
            }
            button.callback_data = parts.join(':').substring(0, 64);
          } else {
            button.callback_data = button.callback_data.substring(0, 64);
          }
        }
      }
    }
  }
}
  // Метод для очистки callback_data
// Метод для очистки callback_data
cleanCallbackData(data) {
  try {
    // ✅ ИСПРАВЛЕНИЕ: Обработка разных типов входных данных
    if (data === undefined || data === null) {
      return '';
    }

    // ✅ ИСПРАВЛЕНИЕ: Преобразуем любые данные в строку
    let dataString;
    if (typeof data === 'string') {
      dataString = data;
    } else if (typeof data === 'number') {
      dataString = data.toString();
    } else if (typeof data === 'boolean') {
      dataString = data ? 'true' : 'false';
    } else if (Buffer.isBuffer(data)) {
      dataString = data.toString('utf8');
    } else if (Array.isArray(data) || typeof data === 'object') {
      dataString = JSON.stringify(data);
    } else {
      dataString = String(data);
    }

    console.log(`🔍 [cleanCallbackData] Входные данные: type=${typeof data}, value=${data}, converted="${dataString}"`);

    // Telegram разрешает только: A-Z, a-z, 0-9, _, -, . и :
    // 1. Удаляем все не-ASCII символы
    // 2. Заменяем неразрешенные символы на _
    // 3. Убираем множественные символы
    let cleaned = dataString
      .replace(/[^\x00-\x7F]/g, '') // Удаляем все не-ASCII символы
      .replace(/[^a-zA-Z0-9_:.-]/g, '_') // Заменяем неразрешенные символы на _
      .replace(/\.{2,}/g, '.') // Убираем множественные точки
      .replace(/_+/g, '_') // Убираем множественные подчеркивания
      .replace(/^-+|-+$/g, '') // Убираем дефисы в начале/конце
      .replace(/^:+|:+$/g, '') // Убираем двоеточия в начале/конце
      .trim();

    // Проверяем длину в байтах (максимум 64 байта для Telegram)
    const byteLength = Buffer.byteLength(cleaned, 'utf8');

    if (byteLength > 64) {
      console.warn(`⚠️ Callback_data превышает 64 байта: ${byteLength}, укорачиваю`);

      // Укорачиваем, сохраняя структуру prefix:id:param
      const parts = cleaned.split(':');

      if (parts.length >= 3) {
        // Сохраняем префикс и ID, укорачиваем параметры
        const prefix = parts[0];
        const id = parts[1];
        const params = parts.slice(2);

        // Укорачиваем каждый параметр отдельно
        const shortenedParams = params.map(param => {
          if (param.length > 10) {
            return param.substring(0, 10);
          }
          return param;
        });

        // Собираем обратно
        const shortened = `${prefix}:${id}:${shortenedParams.join(':')}`;

        // Проверяем длину снова
        const finalByteLength = Buffer.byteLength(shortened, 'utf8');
        if (finalByteLength > 64) {
          // Если все еще слишком длинный, просто обрезаем
          return shortened.substring(0, 64);
        }

        return shortened;
      } else {
        // Просто обрезаем до 64 байт
        // Нужно обрезать по байтам, а не по символам
        let result = '';
        let totalBytes = 0;

        for (let char of cleaned) {
          const charBytes = Buffer.byteLength(char, 'utf8');
          if (totalBytes + charBytes > 64) break;

          result += char;
          totalBytes += charBytes;
        }

        return result;
      }
    }

    return cleaned;
  } catch (error) {
    console.error('❌ Ошибка в cleanCallbackData:', error);
    return '';
  }
}

  // Метод для очистки текста кнопок
  cleanButtonText(text) {
    if (!text) return '';
    
    // Удаляем непечатаемые символы
    const cleaned = text
      .replace(/[\u0000-\u001F\u007F-\u009F\u2000-\u200F\u2028-\u202F\u205F-\u206F\uFEFF]/g, '')
      .replace(/[^\w\s\u0400-\u04FF.,!?;:()\-+]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Обрезаем до 30 символов
    return cleaned.length > 30 ? cleaned.substring(0, 27) + '...' : cleaned;
  }

  // Валидация разметки клавиатуры
  validateReplyMarkup(markup) {
    try {
      if (!markup || typeof markup !== 'object') return false;
      
      if (markup.inline_keyboard) {
        if (!Array.isArray(markup.inline_keyboard)) return false;
        
        for (const row of markup.inline_keyboard) {
          if (!Array.isArray(row)) return false;
          
          for (const button of row) {
            if (!button.text || typeof button.text !== 'string') return false;
            
            if (button.callback_data) {
              if (typeof button.callback_data !== 'string') return false;
              
              // Проверяем длину
              if (button.callback_data.length > 64) {
                console.error(`❌ Callback_data превышает 64 байта: ${button.callback_data.length}`);
                return false;
              }
              
              // Проверяем на недопустимые символы
              const invalidChars = /[^a-zA-Z0-9_:.-]/;
              if (invalidChars.test(button.callback_data)) {
                console.error('❌ Недопустимые символы в callback_data:', button.callback_data);
                return false;
              }
            }
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Ошибка валидации reply_markup:', error);
      return false;
    }
  }

  // Метод очистки данных в БД
  async cleanupPlaceData(chatId) {
    const cities = await cityManager.getAllCities();
    let fixedCount = 0;
    
    for (const city of cities) {
      const places = await placeManager.getPlacesByCity(city);
      
      for (const place of places) {
        const cleanName = this.cleanButtonText(place.name);
        if (cleanName !== place.name) {
          console.log(`🧹 Исправляю название в ${city}: "${place.name}" → "${cleanName}"`);
          
          await placeManager.updatePlace(city, place.id, { name: cleanName });
          fixedCount++;
        }
      }
    }
    
    await this.sendAdminMessage(
      chatId,
      `✅ Очищено ${fixedCount} названий мест от недопустимых символов.`
    );
  }

formatPhoneForCall(phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  console.log(`📱 [DEBUG] Форматируем телефон: "${phone}"`);

  // Удаляем все символы, кроме цифр и +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Если строка пустая после очистки
  if (cleaned.length === 0) {
    return null;
  }

  // Удаляем начальные нули, которые могут мешать
  cleaned = cleaned.replace(/^0+/, '');

  // Проверяем различные международные форматы
  let result = null;

  // Уже в международном формате (начинается с +)
  if (cleaned.startsWith('+')) {
    result = cleaned;
  }
  // Предполагаем, что номер уже в международном формате без +
  else if (cleaned.length >= 10) {
    result = '+' + cleaned;
  }
  // Короткий номер (служба поддержки, справочная и т.д.)
  else {
    result = cleaned;
  }

  console.log(`📱 [DEBUG] Результат форматирования: "${result}"`);
  return result;
}

// Метод для определения типа номера (международный)
getPhoneType(phone) {
  if (!phone) return null;

  const cleaned = phone.replace(/[^\d+]/g, '');

  // Проверяем общие международные коды
  const countryCodes = {
    '+1': '🇺🇸 США/Канада',
    '+7': '🇷🇺 Россия/Казахстан',
    '+44': '🇬🇧 Великобритания',
    '+49': '🇩🇪 Германия',
    '+33': '🇫🇷 Франция',
    '+39': '🇮🇹 Италия',
    '+34': '🇪🇸 Испания',
    '+86': '🇨🇳 Китай',
    '+81': '🇯🇵 Япония',
    '+82': '🇰🇷 Корея',
    '+91': '🇮🇳 Индия',
    '+61': '🇦🇺 Австралия',
    '+55': '🇧🇷 Бразилия',
    '+52': '🇲🇽 Мексика',
    '+20': '🇪🇬 Египет',
    '+27': '🇿🇦 ЮАР'
  };

  // Определяем страну по коду
  for (const [code, country] of Object.entries(countryCodes)) {
    if (cleaned.startsWith(code)) {
      return country;
    }
  }

  // Если не определили страну, проверяем общие паттерны
  if (cleaned.startsWith('+')) {
    return '🌍 Международный номер';
  }

  // Локальные номера
  if (cleaned.length <= 8) {
    return '🏙️ Локальный номер';
  }

  return '📞 Телефон';
}

// Метод для валидации международного номера
isValidInternationalPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;

  const cleaned = phone.replace(/[^\d+]/g, '');

  // Минимальная и максимальная длина для международных номеров
  if (cleaned.length < 7 || cleaned.length > 15) {
    return false;
  }

  // Должен содержать только цифры и возможно + в начале
  if (!/^\+?\d+$/.test(cleaned)) {
    return false;
  }

  return true;
}

// Метод для определения мобильных номеров (международный)
isLikelyMobile(phone) {
  if (!phone) return false;

  const cleaned = phone.replace(/[^\d+]/g, '');

  // Минимальная длина для мобильного номера (с кодом страны)
  if (cleaned.length < 10) return false;

  // Проверяем коды мобильных операторов в разных странах
  const mobilePatterns = [
    /^\+1[2-9]\d{9}$/, // США/Канада
    /^\+7[0-9]{10}$/,  // Россия/Казахстан
    /^\+44[0-9]{10}$/, // Великобритания
    /^\+49[0-9]{11,}$/, // Германия
    /^\+33[0-9]{9}$/,  // Франция
    /^\+39[0-9]{9,10}$/, // Италия
    /^\+34[0-9]{9}$/,  // Испания
    /^\+86[0-9]{11}$/, // Китай
    /^\+81[0-9]{9,10}$/, // Япония
    /^\+82[0-9]{9,10}$/, // Корея
    /^\+91[0-9]{10}$/, // Индия
  ];

  return mobilePatterns.some(pattern => pattern.test(cleaned));
}

normalizeSocialUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }

  let normalized = url.trim();

  // Удаляем все пробелы
  normalized = normalized.replace(/\s+/g, '');

  // Восстанавливаем протокол после двоеточия
  // Если есть "http:" без слешей, добавляем //
  if (normalized.startsWith('http:') && !normalized.startsWith('http://')) {
    normalized = 'http://' + normalized.substring(5);
  } else if (normalized.startsWith('https:') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized.substring(6);
  }

  // Добавляем протокол если его нет
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  // Удаляем лишние слэши
  normalized = normalized.replace(/([^:]\/)\/+/g, '$1');
  
  // Удаляем слэш в конце URL
  if (normalized.endsWith('/') && normalized.length > 8) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

getValidSocialLinks(place) {
    try {
        console.log('🔍 [DEBUG getValidSocialLinks] Исходные данные места:', {
            name: place.name,
            social_links: place.social_links,
            type: typeof place.social_links,
            isArray: Array.isArray(place.social_links)
        });

        // 🔴 ИСПРАВЛЕНИЕ: Обработка разных форматов social_links
        let socialLinks = {};

        // Если social_links - это объект
        if (place.social_links && typeof place.social_links === 'object') {
            // Проверяем, массив ли это
            if (Array.isArray(place.social_links)) {
                console.warn('⚠️ [DEBUG] social_links является массивом, преобразую в объект');
                // Преобразуем массив [[key, value], ...] в объект
                for (const item of place.social_links) {
                    if (Array.isArray(item) && item.length >= 2) {
                        const [key, value] = item;
                        if (key && value) {
                            socialLinks[key] = value;
                        }
                    } else if (item && typeof item === 'object' && item.name && item.url) {
                        // Формат: {name: "Instagram", url: "https://..."}
                        socialLinks[item.name] = item.url;
                    }
                }
            } else {
                // Если это обычный объект
                socialLinks = { ...place.social_links };
            }
        } 
        // Если это строка JSON
        else if (typeof place.social_links === 'string') {
            try {
                const parsed = JSON.parse(place.social_links);
                if (parsed && typeof parsed === 'object') {
                    socialLinks = { ...parsed };
                }
            } catch (error) {
                console.warn('⚠️ Не удалось распарсить social_links как JSON');
            }
        }

        // 🔴 ИСПРАВЛЕНИЕ: Очищаем и нормализуем каждый URL
        const cleanSocialLinks = {};
        
        for (const [name, url] of Object.entries(socialLinks)) {
            try {
                if (!url || typeof url !== 'string') {
                    console.warn(`⚠️ Пропускаем ${name}: URL не строка или пустой`);
                    continue;
                }
                
                const normalizedUrl = this.normalizeSocialUrl(url);
                
                if (normalizedUrl && normalizedUrl.trim() !== '') {
                    cleanSocialLinks[name] = normalizedUrl;
                    console.log(`✅ Нормализован URL: ${name} -> ${normalizedUrl}`);
                } else {
                    console.warn(`❌ Невалидный URL для ${name}: ${url}`);
                }
            } catch (error) {
                console.error(`❌ Ошибка обработки URL для ${name}:`, error.message);
            }
        }

        console.log('🔍 [DEBUG getValidSocialLinks] Результат:', cleanSocialLinks);
        return cleanSocialLinks;

    } catch (error) {
        console.error('❌ Ошибка в getValidSocialLinks:', error);
        return {};
    }
}

  // Метод для валидации URL соцсети
isValidSocialUrl(url) {
  if (!url || typeof url !== 'string') {
    console.warn(`❌ [isValidSocialUrl] Пустой URL или не строка:`, url);
    return false;
  }

  try {
    // Очищаем URL перед валидацией
    const cleanedUrl = url.trim();
    
    // Проверяем минимальную длину
    if (cleanedUrl.length < 10) {
      console.warn(`❌ [isValidSocialUrl] URL слишком короткий: ${cleanedUrl}`);
      return false;
    }
    
    // Проверяем базовую структуру
    if (!cleanedUrl.includes('.')) {
      console.warn(`❌ [isValidSocialUrl] URL не содержит точку: ${cleanedUrl}`);
      return false;
    }
    
    // Проверяем протокол
    if (!cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
      console.warn(`❌ [isValidSocialUrl] URL не начинается с http/https: ${cleanedUrl}`);
      return false;
    }
    
    // Пытаемся создать объект URL
    const urlObj = new URL(cleanedUrl);
    
    // Проверяем наличие hostname
    if (!urlObj.hostname || urlObj.hostname.length < 3) {
      console.warn(`❌ [isValidSocialUrl] Неверный hostname: ${urlObj.hostname}`);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.warn(`❌ [isValidSocialUrl] Неверный формат URL "${url}":`, error.message);
    return false;
  }
}

  // Метод для получения иконки соцсети
  getSocialIcon(url) {
    if (!url || typeof url !== 'string') return '🔗';

    const urlLower = url.toLowerCase();

    const socialIcons = {
      'instagram.com': '📸 Instagram',
      'facebook.com': '📘 Facebook',
      'vk.com': '🇷🇺 VK',
      'twitter.com': '🐦 Twitter',
      'x.com': '🐦 X',
      'tiktok.com': '🎵 TikTok',
      'youtube.com': '📺 YouTube',
      'telegram.org': '📢 Telegram',
      't.me': '📢 Telegram',
      'whatsapp.com': '💬 WhatsApp',
      'linkedin.com': '💼 LinkedIn',
      'pinterest.com': '📌 Pinterest',
      'snapchat.com': '👻 Snapchat',
      'reddit.com': '👽 Reddit',
      'discord.com': '🎮 Discord',
      'twitch.tv': '🎮 Twitch',
      'spotify.com': '🎵 Spotify',
      'apple.com/music': '🎵 Apple Music',
      'soundcloud.com': '🎵 SoundCloud',
      'github.com': '💻 GitHub',
      'medium.com': '📝 Medium',
      'tripadvisor.com': '⭐ TripAdvisor',
      'yelp.com': '⭐ Yelp',
      'foursquare.com': '📍 Foursquare',
      'google.com/maps': '🗺️ Google Maps',
      'yandex.ru/maps': '🗺️ Яндекс.Карты'
    };

    for (const [domain, icon] of Object.entries(socialIcons)) {
      if (urlLower.includes(domain)) {
        return icon;
      }
    }

    // Определяем по паттерну
    if (urlLower.includes('instagram')) return '📸 Instagram';
    if (urlLower.includes('facebook')) return '📘 Facebook';
    if (urlLower.includes('vk')) return '🇷🇺 VK';
    if (urlLower.includes('twitter') || urlLower.includes('x.com')) return '🐦 Twitter';
    if (urlLower.includes('tiktok')) return '🎵 TikTok';
    if (urlLower.includes('youtube')) return '📺 YouTube';
    if (urlLower.includes('telegram') || urlLower.includes('t.me')) return '📢 Telegram';
    if (urlLower.includes('whatsapp')) return '💬 WhatsApp';
    if (urlLower.includes('linkedin')) return '💼 LinkedIn';

    return '🔗 Соцсеть';
  }

  // Метод для форматирования телефона в tel: ссылку (международный формат)



  // Метод для валидации международного номера


  // Метод для определения мобильных номеров (международный)

  // ============ ОСНОВНЫЕ МЕТОДЫ ============
async handleEditSocialLinks(chatId, cityKey, placeId) {
  try {
    const cityName = await this.getCityNameFromKey(cityKey);
    const place = await placeManager.getPlaceById(cityName, placeId);
    const userId = this.userStates.get(chatId)?.userId || chatId;
    
    if (!this.isUserAdmin(userId)) {
      await this.sendAdminMessage(chatId, '❌ У вас нет доступа к этой функции.');
      return;
    }

    if (!place) {
      await this.sendAdminMessage(chatId, '❌ Место не найдено.');
      return;
    }

    this.userStates.set(chatId, {
      action: 'editing_social',
      step: 'select_action',
      cityKey: cityKey,
      placeId: placeId,
      placeData: place
    });

    let message = `✏️ *Редактирование ссылок для "${place.name}"*\n\n`;
    
    if (place.website) {
      message += `🌐 *Сайт:* ${place.website}\n`;
    }
    
    if (place.social_links && Object.keys(place.social_links).length > 0) {
      message += `\n📱 *Текущие социальные сети:*\n`;
      Object.entries(place.social_links).forEach(([name, url], index) => {
        const icon = this.getSocialIcon(url);
        message += `• ${icon} ${name}: ${url}\n`;
      });
    } else {
      message += `\n📭 *Социальные сети не добавлены*\n`;
    }

    const inlineKeyboard = {
      inline_keyboard: []
    };

    // Кнопки для сайта и добавления соцсети
    inlineKeyboard.inline_keyboard.push([
      { 
        text: '🌐 Изменить сайт', 
        callback_data: `edit_social_field:${cityKey}:${placeId}:website` 
      }

    ]);

    // Кнопки для существующих соцсетей
    if (place.social_links && Object.keys(place.social_links).length > 0) {
      const socialEntries = Object.entries(place.social_links);
      
      socialEntries.forEach(([name, url], index) => {
        const shortName = name.length > 12 ? name.substring(0, 10) + '..' : name;
        const icon = this.getSocialIcon(url);
        
        inlineKeyboard.inline_keyboard.push([
          { 
            text: `✏️ ${icon} ${shortName}`, 
            callback_data: `edit_social_item:${cityKey}:${placeId}:${index}` 
          },
          { 
            text: '🗑️', 
            callback_data: `delete_social_item:${cityKey}:${placeId}:${index}` 
          }
        ]);
      });
    }

    // Кнопки навигации
    inlineKeyboard.inline_keyboard.push([
      { text: '🔙 Назад к месту', callback_data: `show_place:${cityKey}:${placeId}` },
      { text: '❌ Отмена', callback_data: 'admin_action:cancel' }
    ]);

    // Очищаем callback_data в inline_keyboard перед отправкой
    this.cleanInlineKeyboard(inlineKeyboard);
    
    // Проверяем валидность разметки
    if (!this.validateReplyMarkup(inlineKeyboard)) {
      console.error('❌ Некорректная клавиатура после очистки');
      await this.sendAdminMessage(chatId, message, { parse_mode: 'Markdown' });
      return;
    }

    await this.sendAdminMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });

  } catch (error) {
    console.error('❌ Ошибка при редактировании соцсетей:', error);
    await this.sendAdminMessage(chatId, '❌ Произошла ошибка при загрузке данных.');
  }
}


async handleEditSocialField(chatId, cityKey, placeId, field) {
  try {
    console.log(`🔧 [handleEditSocialField] Параметры:`, { cityKey, placeId, field });
    
    // Проверяем, что field не пустой
    if (!field || field.trim() === '') {
      console.error('❌ Пустой field в handleEditSocialField');
      await this.sendAdminMessage(chatId, '❌ Ошибка: не указано поле для редактирования.');
      
      // Показываем меню снова
      setTimeout(async () => {
        await this.handleEditSocialLinks(chatId, cityKey, placeId);
      }, 500);
      return;
    }
    
    const cityName = await this.getCityNameFromKey(cityKey);
    const place = await placeManager.getPlaceById(cityName, placeId);
    
    if (!place) {
      await this.sendAdminMessage(chatId, '❌ Место не найдено.');
      return;
    }
    
    // Обработка разных полей
    if (field === 'website') {
      this.userStates.set(chatId, {
        action: 'editing_social_field',
        step: 'enter_value',
        cityKey: cityKey,
        placeId: placeId,
        field: 'website',
        placeData: place
      });
      
      const currentValue = place.website || 'не указан';
      await this.sendAdminMessage(
        chatId,
        `✏️ *Редактирование сайта для "${place.name}"*\n\n` +
        `Текущий сайт: ${currentValue}\n\n` +
        `Введите новый URL сайта (для удаления отправьте "-"):`,
        { parse_mode: 'Markdown' }
      );
      
    } else if (field === 'add_social') {
      this.userStates.set(chatId, {
        action: 'editing_social_field',
        step: 'enter_value',
        cityKey: cityKey,
        placeId: placeId,
        field: 'add_social',
        placeData: place
      });
      
      await this.sendAdminMessage(
        chatId,
        `✏️ *Добавление социальной сети для "${place.name}"*\n\n` +
        `*Формат ввода:*\n` +
        `Название: URL\n\n` +
        `*Пример:*\n` +
        `Instagram: https://instagram.com/place\n` +
        `Facebook: https://facebook.com/place\n\n` +
        `Введите данные в указанном формате:`,
        { parse_mode: 'Markdown' }
      );
      
    } else {
      // Пытаемся получить индекс соцсети
      const index = parseInt(field);
      if (!isNaN(index)) {
        // Это индекс существующей соцсети
        await this.handleEditSocialItem(chatId, cityKey, placeId, index);
      } else {
        await this.sendAdminMessage(chatId, `❌ Неизвестное поле: ${field}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка в handleEditSocialField:', error);
    await this.sendAdminMessage(chatId, '❌ Произошла ошибка.');
  }
}
// Метод для редактирования конкретной соцсети
async handleEditSocialItem(chatId, cityKey, placeId, socialIndex) {
  try {
    console.log(`✏️ [handleEditSocialItem] Параметры:`, { cityKey, placeId, socialIndex });
    
    const cityName = await this.getCityNameFromKey(cityKey);
    const place = await placeManager.getPlaceById(cityName, placeId);
    
    console.log(`📊 [DEBUG place]:`, {
      exists: !!place,
      name: place?.name,
      hasSocialLinks: !!place?.social_links,
      socialLinksType: typeof place?.social_links,
      socialLinks: place?.social_links
    });
    
    if (!place) {
      await this.sendAdminMessage(chatId, '❌ Место не найдено.');
      return;
    }
    
    // ✅ ПРОВЕРКА: Если social_links отсутствует или пустой
    if (!place.social_links || typeof place.social_links !== 'object' || Object.keys(place.social_links).length === 0) {
      await this.sendAdminMessage(chatId, '❌ У этого места нет социальных сетей.');
      return;
    }
    
    // ✅ Получаем соцсеть по индексу
    const socialEntries = Object.entries(place.social_links);
    const index = parseInt(socialIndex);
    
    console.log(`📊 [DEBUG социальные сети]:`, {
      totalCount: socialEntries.length,
      requestedIndex: index,
      entries: socialEntries
    });
    
    if (isNaN(index) || index < 0 || index >= socialEntries.length) {
      await this.sendAdminMessage(chatId, `❌ Неверный индекс соцсети: ${socialIndex}`);
      return;
    }
    
    const [socialName, socialUrl] = socialEntries[index];
    
    console.log(`✅ Найдена соцсеть по индексу ${index}:`, { socialName, socialUrl });
    
    this.userStates.set(chatId, {
      action: 'editing_social_item',
      step: 'enter_value',
      cityKey: cityKey,
      placeId: placeId,
      socialName: socialName,
      socialUrl: socialUrl,
      placeData: place
    });
    
    const message = `✏️ *Редактирование соцсети "${socialName}"*\n\n` +
                   `Текущий URL: ${socialUrl}\n\n` +
                   `Введите новый URL (для удаления отправьте "-"):`;
    
    await this.sendAdminMessage(chatId, message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('❌ Ошибка при редактировании соцсети:', error);
    await this.sendAdminMessage(chatId, '❌ Произошла ошибка.');
  }
}

async handleDeleteSocialItem(chatId, cityKey, placeId, socialIndex) {
  try {
    const cityName = await this.getCityNameFromKey(cityKey);
    const place = await placeManager.getPlaceById(cityName, placeId);
    
    if (!place || !place.social_links) {
      await this.sendAdminMessage(chatId, '❌ Место или соцсети не найдены.');
      return;
    }
    
    // ✅ Получаем соцсеть по индексу
    const socialEntries = Object.entries(place.social_links);
    const index = parseInt(socialIndex);
    
    if (index < 0 || index >= socialEntries.length) {
      await this.sendAdminMessage(chatId, '❌ Соцсеть не найдена.');
      return;
    }
    
    const [socialName, socialUrl] = socialEntries[index];
    
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { 
            text: '✅ Да, удалить', 
            callback_data: `confirm_delete_social:${cityKey}:${placeId}:${index}` 
          },
          { 
            text: '❌ Нет, отмена', 
            callback_data: `edit_social:${cityKey}:${placeId}` 
          }
        ]
      ]
    };
    
    await this.sendAdminMessage(
      chatId,
      `🗑️ *Удаление соцсети*\n\n` +
      `Вы уверены, что хотите удалить соцсеть "${socialName}"?\n` +
      `URL: ${socialUrl}\n\n` +
      `Это действие нельзя отменить!`,
      {
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard
      }
    );
    
  } catch (error) {
    console.error('❌ Ошибка при удалении соцсети:', error);
    await this.sendAdminMessage(chatId, '❌ Произошла ошибка.');
  }
}

async testUberDeeplink(chatId, place) {
  if (!place.latitude || !place.longitude) {
    await this.sendAdminMessage(chatId, '❌ Нет координат для теста Uber');
    return;
  }
  
  const deeplink = this.generateUberLink(place);
  const webLink = this.generateUberWebLink(place);
  
  let message = `🚗 *Тест Uber deeplink*\n\n`;
  message += `📍 *Место:* ${place.name}\n`;
  message += `🌍 *Координаты:* ${place.latitude}, ${place.longitude}\n`;
  message += `📌 *Адрес:* ${place.address || 'нет'}\n`;
  message += `🏷️ *Google Place ID:* ${place.google_place_id || 'нет'}\n\n`;
  
  message += `*Deeplink (для приложения):*\n`;
  message += `\`${deeplink}\`\n\n`;
  
  message += `*Веб-ссылка (для браузера):*\n`;
  message += `\`${webLink}\`\n\n`;
  
  message += `📱 *На мобильном устройстве* deeplink откроет приложение Uber.\n`;
  message += `💻 *На десктопе* можно использовать веб-версию.`;
  
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '🚗 Открыть в приложении', url: deeplink }
      ],
      [
        { text: '🌐 Открыть в браузере', url: webLink }
      ],
      [
        { text: '🔙 Назад', callback_data: 'admin_action:back_to_panel' }
      ]
    ]
  };
  
  await this.sendAdminMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}



// Метод для удаления соцсети
async handleDeleteSocialItem(chatId, cityKey, placeId, socialName) {
  try {
    const cityName = await this.getCityNameFromKey(cityKey);
    const place = await placeManager.getPlaceById(cityName, placeId);
    
    console.log(`🗑️ [handleDeleteSocialItem] Пытаюсь удалить соцсеть "${socialName}"`);
    console.log(`📊 [DEBUG] Данные места:`, {
      name: place?.name,
      hasSocialLinks: !!place?.social_links,
      socialLinksType: typeof place?.social_links,
      socialLinksKeys: place?.social_links ? Object.keys(place.social_links) : []
    });
    
    if (!place) {
      await this.sendAdminMessage(chatId, '❌ Место не найдено.');
      return;
    }
    
    if (!place.social_links || typeof place.social_links !== 'object') {
      await this.sendAdminMessage(chatId, '❌ У этого места нет социальных сетей.');
      return;
    }
    
    // ✅ Декодируем название соцсети (на случай если оно было закодировано)
    const decodedSocialName = decodeURIComponent(socialName);
    
    console.log(`🔍 Ищу соцсеть:`, {
      encoded: socialName,
      decoded: decodedSocialName,
      available: Object.keys(place.social_links)
    });
    
    // Ищем соцсеть по имени (с учетом разных вариантов)
    let foundSocialName = null;
    let foundSocialUrl = null;
    
    for (const [name, url] of Object.entries(place.social_links)) {
      if (name === socialName || 
          name === decodedSocialName || 
          encodeURIComponent(name) === socialName) {
        foundSocialName = name;
        foundSocialUrl = url;
        break;
      }
    }
    
    if (!foundSocialName) {
      console.error(`❌ Соцсеть не найдена. Искали: "${socialName}" (decoded: "${decodedSocialName}")`);
      console.error(`❌ Доступные соцсети:`, Object.keys(place.social_links));
      
      await this.sendAdminMessage(
        chatId,
        `❌ Соцсеть "${decodedSocialName}" не найдена.\n\n` +
        `Доступные соцсети:\n${Object.keys(place.social_links).map(n => `• ${n}`).join('\n')}`
      );
      return;
    }
    
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { 
            text: '✅ Да, удалить', 
            callback_data: `confirm_delete_social:${cityKey}:${placeId}:${encodeURIComponent(foundSocialName)}` 
          },
          { 
            text: '❌ Нет, отмена', 
            callback_data: `edit_social:${cityKey}:${placeId}` 
          }
        ]
      ]
    };
    
    await this.sendAdminMessage(
      chatId,
      `🗑️ *Удаление соцсети*\n\n` +
      `Вы уверены, что хотите удалить соцсеть "${foundSocialName}"?\n` +
      `URL: ${foundSocialUrl}\n\n` +
      `Это действие нельзя отменить!`,
      {
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard
      }
    );
    
  } catch (error) {
    console.error('❌ Ошибка при удалении соцсети:', error);
    await this.sendAdminMessage(chatId, '❌ Произошла ошибка.');
  }
}




// Метод для валидации URL соцсети
isValidSocialUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Проверяем, что это валидный URL
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// Метод для подтверждения удаления соцсети
async confirmDeleteSocial(chatId, cityKey, placeId, socialIndex) {
  try {
    const cityName = await this.getCityNameFromKey(cityKey);
    const place = await placeManager.getPlaceById(cityName, placeId);
    
    if (!place || !place.social_links) {
      await this.sendAdminMessage(chatId, '❌ Место или соцсети не найдены.');
      return;
    }
    
    const socialEntries = Object.entries(place.social_links);
    const index = parseInt(socialIndex);
    
    if (index < 0 || index >= socialEntries.length) {
      await this.sendAdminMessage(chatId, '❌ Соцсеть не найдена.');
      return;
    }
    
    const [socialName] = socialEntries[index];
    
    // Удаляем соцсеть
    const socialLinks = { ...place.social_links };
    delete socialLinks[socialName];
    
    const updateData = { social_links: socialLinks };
    const result = await placeManager.updatePlace(cityName, placeId, updateData);
    
    if (result.success) {
      await this.sendAdminMessage(
        chatId,
        `✅ Соцсеть "${socialName}" успешно удалена!`,
        { parse_mode: 'Markdown' }
      );
      
      setTimeout(async () => {
        await this.handleEditSocialLinks(chatId, cityKey, placeId);
      }, 1000);
    } else {
      await this.sendAdminMessage(chatId, `❌ Ошибка: ${result.message}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при удалении соцсети:', error);
    await this.sendAdminMessage(chatId, '❌ Произошла ошибка при удалении.');
  }
}

  // Проверяем, находится ли пользователь в админ-сессии
  isInAdminSession(chatId) {
    const state = this.userStates.get(chatId);
    if (!state) return false;
    
    // Проверяем, находится ли пользователь в процессе администрирования
    const adminActions = [
      'adding_city', 
      'adding_place', 
      'editing_place', 
      'adding_category',
      'testing_photo'
    ];
    
    // Если состояние связано с админ-панелью
    if (state.action && adminActions.includes(state.action)) {
      return true;
    }
    
    // Если пользователь находится в админ-панели (после нажатия кнопки Администрирование)
    // и не нажал "Главное меню"
    if (this.adminSessions.get(chatId)) {
      return true;
    }
    
    return false;
  }

  // Удаление предыдущего сообщения (только для обычных пользователей)
  async deleteLastMessage(chatId) {
    // Не удаляем сообщения, если пользователь в админ-сессии
    if (this.isInAdminSession(chatId)) {
      return;
    }
    
    const messageIds = this.lastBotMessages.get(chatId);
    
    if (messageIds && messageIds.length > 0) {
      for (const messageId of messageIds) {
        try {
          await this.bot.deleteMessage(chatId, messageId);
          console.log(`🗑️ Удалено сообщение ${messageId}`);
        } catch (error) {
          if (error.response && error.response.statusCode === 400) {
            console.log(`⚠️ Сообщение ${messageId} уже удалено или недоступно`);
          } else {
            console.log(`⚠️ Не удалось удалить сообщение ${messageId}: ${error.message}`);
          }
        }
      }
    }
    
    this.lastBotMessages.delete(chatId);
  }

  // Сохранение ID отправленного сообщения (только для обычных пользователей)
  async sendAndTrack(chatId, text, options = {}) {
    // Валидация и очистка клавиатуры перед отправкой
    if (options.reply_markup && options.reply_markup.inline_keyboard) {
      this.cleanInlineKeyboard(options.reply_markup);
      
      // Удаляем кнопки без url и callback_data
      options.reply_markup.inline_keyboard = options.reply_markup.inline_keyboard
        .map(row => row.filter(button => button.url || button.callback_data))
        .filter(row => row.length > 0);
    }
    
    const message = await this.bot.sendMessage(chatId, text, options);
    
    // Не отслеживаем сообщения в админ-сессиях
    if (this.isInAdminSession(chatId)) {
      return message;
    }
    
    if (!this.lastBotMessages.has(chatId)) {
      this.lastBotMessages.set(chatId, []);
    }
    this.lastBotMessages.get(chatId).push(message.message_id);
    
    return message;
  }

  // Для админ-панели: отправка без отслеживания
 async sendAdminMessage(chatId, text, options = {}) {
  try {
    console.log(`📤 [sendAdminMessage] Отправляю в ${chatId}: ${text.substring(0, 50)}...`);
    
    // Автоматически чистим callback_data в inline_keyboard перед отправкой
    if (options.reply_markup && options.reply_markup.inline_keyboard) {
      this.cleanInlineKeyboard(options.reply_markup);
    }
    
    // Валидируем разметку
    if (options.reply_markup && !this.validateReplyMarkup(options.reply_markup)) {
      console.warn('⚠️ Некорректный reply_markup после очистки, отправляю без него');
      delete options.reply_markup;
    }
    
    const result = await this.bot.sendMessage(chatId, text, options);
    console.log(`✅ [sendAdminMessage] Сообщение отправлено успешно, ID: ${result.message_id}`);
    return result;
    
  } catch (error) {
    console.error(`❌ [sendAdminMessage] Ошибка при отправке в ${chatId}:`, error.message);
    console.error('❌ Полная ошибка:', error);
    
    // Пробуем отправить без разметки
    try {
      console.log(`🔄 [sendAdminMessage] Пробую отправить без разметки...`);
      return await this.bot.sendMessage(chatId, text);
    } catch (secondError) {
      console.error('❌ [sendAdminMessage] Ошибка при повторной отправке:', secondError.message);
      return null;
    }
  }
}

  // Отправка фото с отслеживанием (только для обычных пользователей)
  async sendPhotoAndTrack(chatId, photo, options = {}) {
    const message = await this.bot.sendPhoto(chatId, photo, options);
    
    // Не отслеживаем фото в админ-сессиях
    if (this.isInAdminSession(chatId)) {
      return message;
    }
    
    if (!this.lastBotMessages.has(chatId)) {
      this.lastBotMessages.set(chatId, []);
    }
    this.lastBotMessages.get(chatId).push(message.message_id);
    
    return message;
  }

  async handlePhotoMessage(chatId, msg) {
    console.log('📸 Получено фото сообщение');
    
    const userState = this.userStates.get(chatId);
    
    // Проверяем, что пользователь действительно в состоянии добавления фото
    if (!userState || userState.action !== 'adding_place' || userState.step !== 'add_photos') {
      console.log('⚠️ Пользователь не в состоянии добавления фото');
      return;
    }
    
    if (!msg.photo || !Array.isArray(msg.photo) || msg.photo.length === 0) {
      console.warn('⚠️ Нет фото в сообщении');
      return;
    }
    
    if (!this.userPhotos.has(chatId)) {
      this.userPhotos.set(chatId, []);
      console.log('🆕 Создано новое хранилище фото для пользователя');
    }
    
    const photos = this.userPhotos.get(chatId);
    
    if (photos.length >= 10) {
      await this.sendAdminMessage(
        chatId,
        '❌ Достигнут лимит в 10 фото.\n' +
        'Нажмите "✅ Готово" для завершения.'
      );
      return;
    }
    
    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;
    
    console.log(`✅ Добавляю file_id: ${fileId}`);
    
    photos.push(fileId);
    this.userPhotos.set(chatId, photos);
    
    console.log(`📊 Всего фото у пользователя: ${photos.length}`);
    
    await this.sendAdminMessage(
      chatId,
      `📷 Фото ${photos.length}/10 добавлено!\n\n` +
      `Можно отправить еще фото или нажать "✅ Готово" для завершения.`
    );
  }

  async handleCityPhotoMessage(chatId, msg, state) {
    console.log('📸 Получено фото для города');
    
    if (!msg.photo || !Array.isArray(msg.photo) || msg.photo.length === 0) {
      console.warn('⚠️ Нет фото в сообщении');
      return;
    }
    
    const photo = msg.photo[msg.photo.length - 1];
    state.photoFileId = photo.file_id;
    state.step = 'finish';
    this.userStates.set(chatId, state);
    
    await this.sendAdminMessage(chatId, '✅ Фото сохранено!');
    await this.finishAddingCity(chatId, state);
  }



async handleAddingPlace(chatId, msg, state) {
  const text = msg.text;

  // Фото обрабатываются отдельным обработчиком
  if (msg.photo) {
    return;
  }

  if (state.step === 'create_category') {
    await this.handleCreateCategory(chatId, text, state);
    return;
  }

  switch(state.step) {
    case 'enter_name':
      if (!text || text.trim().length < 2) {
        await this.sendAdminMessage(
          chatId,
          '❌ Название места должно содержать минимум 2 символа.\n' +
          'Пожалуйста, введите название заново:'
        );
        return;
      }

      state.placeData.name = text.trim();
      state.step = 'enter_address';
      this.userStates.set(chatId, state);

      await this.sendAdminMessage(
        chatId,
        `✅ Название сохранено: *${state.placeData.name}*\n\n` +
        `📍 Теперь введите адрес места:`,
        { parse_mode: 'Markdown' }
      );
      break;

    case 'enter_address':
      if (!text || text.trim().length < 5) {
        await this.sendAdminMessage(
          chatId,
          '❌ Адрес должен содержать минимум 5 символов.\n' +
          'Пожалуйста, введите адрес заново:'
        );
        return;
      }

      state.placeData.address = text.trim();
      state.step = 'enter_working_hours';
      this.userStates.set(chatId, state);

      await this.sendAdminMessage(
        chatId,
        `📍 Адрес сохранен.\n\n` +
        `⏰ Теперь введите время работы (например: "10:00 - 22:00 ежедневно"):`,
        { parse_mode: 'Markdown' }
      );
      break;

    case 'enter_working_hours':
      state.placeData.working_hours = text.trim();
      state.step = 'enter_price';
      this.userStates.set(chatId, state);

      await this.sendAdminMessage(
        chatId,
        `⏰ Время работы сохранено.\n\n` +
        `💰 Теперь введите средний чек (например: "1000-2000 руб" или "бесплатно"):`,
        { parse_mode: 'Markdown' }
      );
      break;

    case 'enter_price':
      state.placeData.average_price = text.trim();
      state.step = 'enter_description';
      this.userStates.set(chatId, state);

      await this.sendAdminMessage(
        chatId,
        `💰 Ценовая категория сохранена.\n\n` +
        `📝 Теперь введите описание места (можно подробное):`,
        { parse_mode: 'Markdown' }
      );
      break;

    case 'enter_description':
      if (!text || text.trim().length < 10) {
        await this.sendAdminMessage(
          chatId,
          '❌ Описание должно содержать минимум 10 символов.\n' +
          'Пожалуйста, введите описание заново:'
        );
        return;
      }

      state.placeData.description = text.trim();
      state.step = 'enter_website';
      this.userStates.set(chatId, state);

      await this.sendAdminMessage(
        chatId,
        `📝 Описание сохранено.\n\n` +
        `🌐 Теперь введите сайт (URL). Для пропуска отправьте "-":`,
        { parse_mode: 'Markdown' }
      );
      break;

    case 'enter_website':
      if (text !== '-') {
        if (text.includes('http://') || text.includes('https://')) {
          state.placeData.website = text.trim();
        } else {
          state.placeData.website = `https://${text.trim()}`;
        }
      }
      state.step = 'enter_phone';
      this.userStates.set(chatId, state);

      await this.sendAdminMessage(
        chatId,
        `🌐 Сайт сохранен.\n\n` +
        `📱 Теперь введите телефон. Для пропуска отправьте "-":`,
        { parse_mode: 'Markdown' }
      );
      break;

    case 'enter_phone':
      if (text !== '-') {
        const phoneRegex = /^[+\d\s\-\(\)\.]{5,20}$/;
        if (!phoneRegex.test(text)) {
          await this.sendAdminMessage(
            chatId,
            '❌ Некорректный формат номера телефона.\n\n' +
            '*Примеры международных форматов:*\n' +
            '• 🇺🇸 США: +1 (555) 123-4567\n' +
            '• 🇷🇺 Россия: +7 999 123-45-67\n' +
            '• 🇬🇧 UK: +44 7911 123456\n\n' +
            'Пожалуйста, введите номер в международном формате:',
            { parse_mode: 'Markdown' }
          );
          return;
        }
        state.placeData.phone = text.trim();
      }
      state.step = 'enter_map';
      this.userStates.set(chatId, state);

      await this.sendAdminMessage(
        chatId,
        `📱 Телефон сохранен.\n\n` +
        `📍 Теперь введите ссылку на карту (Google Maps или Яндекс.Карты).\n` +
        `Для пропуска отправьте "-":`,
        { parse_mode: 'Markdown' }
      );
      break;

    case 'enter_map':
      if (text === '-') {
        state.placeData.map_url = null;
        state.step = 'enter_social';
        this.userStates.set(chatId, state);

        await this.sendAdminMessage(
          chatId,
          `✅ Карта пропущена.\n\n` +
          `📱 Теперь можно добавить социальные сети.\n\n` +
          `*Формат:* Название:URL (каждая с новой строки)\n` +
          `*Пример:*\n` +
          `Instagram: https://instagram.com/place\n` +
          `Facebook: https://facebook.com/place\n\n` +
          `Для пропуска отправьте "-":`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      state.placeData.map_url = text.trim();

      const extractedData = await this.extractDataFromMapUrl(text.trim());

      if (extractedData.success) {
        state.placeData.latitude = extractedData.latitude;
        state.placeData.longitude = extractedData.longitude;
        state.placeData.google_place_id = extractedData.google_place_id;

        let successMessage = `✅ *Данные из Google Maps извлечены!*\n\n`;
        successMessage += `📍 *Ссылка сохранена:* ${text.trim().substring(0, 50)}...\n`;
        successMessage += `🌍 *Координаты:* ${extractedData.latitude}, ${extractedData.longitude}\n`;
        if (extractedData.google_place_id) {
          successMessage += `🏷️ *Google Place ID:* ${extractedData.google_place_id}\n`;
        }
        successMessage += `\n📱 Теперь можно добавить социальные сети.\n\n`;
        successMessage += `*Формат:* Название:URL (каждая с новой строки)\n`;
        successMessage += `*Пример:*\n`;
        successMessage += `Instagram: https://instagram.com/place\n`;
        successMessage += `Facebook: https://facebook.com/place\n\n`;
        successMessage += `Для пропуска отправьте "-":`;

        await this.sendAdminMessage(chatId, successMessage, { parse_mode: 'Markdown' });
        state.step = 'enter_social';
        this.userStates.set(chatId, state);
      } else {
        await this.sendAdminMessage(
          chatId,
          `❌ *Не удалось извлечь данные из ссылки*\n\n` +
          `Ссылка сохранена, но координаты не найдены.\n\n` +
          `Что вы хотите сделать?`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                ['🌍 Ввести координаты вручную'],
                ['📱 Перейти к соцсетям'],
                ['❌ Отменить добавление']
              ],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          }
        );
        state.step = 'map_extraction_failed';
        this.userStates.set(chatId, state);
      }
      break;

    case 'map_extraction_failed':
      if (text === '🌍 Ввести координаты вручную') {
        state.step = 'enter_latitude_manual';
        this.userStates.set(chatId, state);
        await this.sendAdminMessage(
          chatId,
          `🌍 *Введите широту вручную*\n\n` +
          `Пример: 41.3851\n` +
          `Для пропуска отправьте "-":`,
          { parse_mode: 'Markdown' }
        );
      } else if (text === '📱 Перейти к соцсетям') {
        state.step = 'enter_social';
        this.userStates.set(chatId, state);
        await this.sendAdminMessage(
          chatId,
          `✅ Переходим к социальным сетям.\n\n` +
          `📱 *Добавление социальных сетей*\n\n` +
          `*Формат:* Название:URL (каждая с новой строки)\n` +
          `*Пример:*\n` +
          `Instagram: https://instagram.com/place\n` +
          `Facebook: https://facebook.com/place\n\n` +
          `Для пропуска отправьте "-":`,
          { parse_mode: 'Markdown' }
        );
      }
      break;

    case 'enter_latitude_manual':
      if (text !== '-') {
        const lat = parseFloat(text.replace(',', '.'));
        if (isNaN(lat) || lat < -90 || lat > 90) {
          await this.sendAdminMessage(
            chatId,
            '❌ Неверная широта. Введите число от -90 до 90.\n\nПопробуйте еще раз:'
          );
          return;
        }
        state.placeData.latitude = lat;
      }
      state.step = 'enter_longitude_manual';
      this.userStates.set(chatId, state);
      await this.sendAdminMessage(
        chatId,
        `✅ Широта сохранена.\n\n` +
        `🌍 *Введите долготу вручную*\n\n` +
        `Пример: 2.1734\n` +
        `Для пропуска отправьте "-":`,
        { parse_mode: 'Markdown' }
      );
      break;

    case 'enter_longitude_manual':
      if (text !== '-') {
        const lon = parseFloat(text.replace(',', '.'));
        if (isNaN(lon) || lon < -180 || lon > 180) {
          await this.sendAdminMessage(
            chatId,
            '❌ Неверная долгота. Введите число от -180 до 180.\n\nПопробуйте еще раз:'
          );
          return;
        }
        state.placeData.longitude = lon;
      }
      state.step = 'enter_social';
      this.userStates.set(chatId, state);
      let manualCoordsMessage = `✅ Данные сохранены.\n\n`;
      if (state.placeData.latitude && state.placeData.longitude) {
        manualCoordsMessage += `🌍 *Координаты:* ${state.placeData.latitude}, ${state.placeData.longitude}\n\n`;
      }
      manualCoordsMessage += `📱 *Теперь можно добавить социальные сети.*\n\n`;
      manualCoordsMessage += `*Формат:* Название:URL (каждая с новой строки)\n`;
      manualCoordsMessage += `*Пример:*\n`;
      manualCoordsMessage += `Instagram: https://instagram.com/place\n`;
      manualCoordsMessage += `Facebook: https://facebook.com/place\n\n`;
      manualCoordsMessage += `Для пропуска отправьте "-":`;
      await this.sendAdminMessage(chatId, manualCoordsMessage, { parse_mode: 'Markdown' });
      break;

    case 'enter_social':
      if (text === '-') {
        state.placeData.social_links = {};
        state.step = 'add_photos';
        this.userStates.set(chatId, state);
        await this.sendAdminMessage(
          chatId,
          `✅ Соцсети пропущены.\n\n` +
          `📷 Теперь можно добавить фото места.\n\n` +
          `*Инструкция:*\n` +
          `1. Отправьте фото места (можно несколько)\n` +
          `2. После отправки всех фото нажмите "✅ Готово"\n` +
          `3. Для пропуска нажмите "⏭️ Пропустить"\n\n` +
          `_Вы можете отправить до 10 фото_`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                ['✅ Готово', '⏭️ Пропустить'],
                ['❌ Отменить добавление']
              ],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          }
        );
        return;
      }

      const normalizedUrl = this.normalizeSocialUrl(text);
      if (!this.isValidSocialUrl(normalizedUrl)) {
        await this.sendAdminMessage(
          chatId,
          `❌ Неверный URL: ${text}\n\n` +
          `Пожалуйста, введите корректный URL (например: https://instagram.com/place):`
        );
        return;
      }

      const socialName = this.getSocialNameFromUrl(normalizedUrl);
      state.placeData.social_links = { [socialName]: normalizedUrl };
      state.step = 'add_photos';
      this.userStates.set(chatId, state);

      const socialMessage = `✅ Социальная сеть добавлена!\n\n` +
        `📱 *${socialName}:* ${normalizedUrl}\n\n` +
        `📷 Теперь можно добавить фото места.\n\n` +
        `*Инструкция:*\n` +
        `1. Отправьте фото места (можно несколько)\n` +
        `2. После отправки всех фото нажмите "✅ Готово"\n` +
        `3. Для пропуска нажмите "⏭️ Пропустить"\n\n` +
        `_Вы можете отправить до 10 фото_`;

      await this.sendAdminMessage(
        chatId,
        socialMessage,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              ['✅ Готово', '⏭️ Пропустить'],
              ['❌ Отменить добавление']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
      break;

    case 'add_photos':
      if (text === '✅ Готово') {
        await this.finishAddingPlace(chatId, state);
      } else if (text === '⏭️ Пропустить') {
        state.placeData.photos = [];
        await this.finishAddingPlace(chatId, state);
      } else if (text === '❌ Отменить добавление') {
        this.userStates.delete(chatId);
        this.userPhotos.delete(chatId);
        await this.sendAdminMessage(
          chatId,
          '❌ Добавление места отменено.',
          { reply_markup: { remove_keyboard: true } }
        );
        await this.showAdminPanel(chatId);
      }
      break;
  }
}

async finishAddingPlace(chatId, state) {
  console.log('🏁 Начинаю завершение добавления места...');
  
  // 🔥 FIREBASE-FIRST: Сначала сохраняем в Firebase
  if (this.firebaseDB && this.firebaseDB.initialized) {
    try {
      const firebasePlace = {
        ...state.placeData,
        city: state.city,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'bot'
      };
      
      if (this.userPhotos.has(chatId)) {
        const photos = this.userPhotos.get(chatId);
        if (photos.length > 0) {
          const uploadedPhotos = await this.uploadPhotosToFirebase(photos);
          firebasePlace.photos = uploadedPhotos;
        }
      }
      
      const firebaseResult = await this.firebaseDB.addPlace(firebasePlace);
      console.log('✅ Место сохранено в Firebase:', firebaseResult);
    } catch (firebaseError) {
      console.error('❌ Ошибка сохранения места в Firebase:', firebaseError);
    }
  }

  console.log('🔍 [DEBUG finishAddingPlace] Данные места перед сохранением:', {
    socialLinks: state.placeData.social_links,
    socialLinksType: typeof state.placeData.social_links,
    hasSocialLinks: !!state.placeData.social_links,
    socialLinksKeys: state.placeData.social_links ? Object.keys(state.placeData.social_links) : []
  });
  
  const photoFileIds = this.userPhotos.get(chatId) || [];
  console.log(`📸 File IDs для загрузки в Firebase: ${photoFileIds.length} шт.`);
  
  let uploadedPhotos = [];
  
  if (photoFileIds.length > 0 && this.firebaseStorage && this.firebaseStorage.initialized) {
    console.log('☁️ Начинаю загрузку фото в Firebase...');
    for (let i = 0; i < photoFileIds.length; i++) {
      const fileId = photoFileIds[i];
      try {
        console.log(`📥 Загружаю фото ${i + 1}/${photoFileIds.length} в Firebase...`);
        const firebaseResult = await this.firebaseStorage.uploadPhotoFromTelegram(fileId, this.botToken);
        if (firebaseResult.success) {
          uploadedPhotos.push({
            url: firebaseResult.url,
            fileName: firebaseResult.fileName,
            uploadedAt: firebaseResult.uploadedAt,
            telegramFileId: fileId
          });
          console.log(`✅ Фото ${i + 1} загружено в Firebase: ${firebaseResult.url}`);
        } else {
          console.log(`❌ Не удалось загрузить фото ${i + 1} в Firebase:`, firebaseResult.error);
        }
      } catch (error) {
        console.error(`❌ Ошибка при обработке фото ${i + 1}:`, error);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } else if (photoFileIds.length > 0) {
    console.log('⚠️ Firebase Storage не доступен, сохраняю только file_id');
    photoFileIds.forEach(fileId => {
      uploadedPhotos.push({
        telegramFileId: fileId,
        error: 'Firebase недоступен'
      });
    });
  }
  
  this.userPhotos.delete(chatId);
  
  console.log('🌍 [DEBUG] Проверяю координаты перед сохранением:');
  console.log('  - map_url:', state.placeData.map_url || 'НЕТ');
  console.log('  - latitude:', state.placeData.latitude || 'НЕТ');
  console.log('  - longitude:', state.placeData.longitude || 'НЕТ');
  console.log('  - google_place_id:', state.placeData.google_place_id || 'НЕТ');
  
  if (state.placeData.map_url && (!state.placeData.latitude || !state.placeData.longitude)) {
    console.log('⚠️ Обнаружена ссылка на карту без координат. Пытаюсь извлечь...');
    const extractedData = await this.extractDataFromMapUrl(state.placeData.map_url);
    if (extractedData.success) {
      state.placeData.latitude = extractedData.latitude;
      state.placeData.longitude = extractedData.longitude;
      if (extractedData.google_place_id) {
        state.placeData.google_place_id = extractedData.google_place_id;
      }
      console.log('✅ Координаты успешно извлечены при сохранении:');
      console.log('  - latitude:', extractedData.latitude);
      console.log('  - longitude:', extractedData.longitude);
      console.log('  - google_place_id:', extractedData.google_place_id || 'НЕТ');
    } else {
      console.log('❌ Не удалось извлечь координаты:', extractedData.message);
    }
  }
  
  const photosToSave = uploadedPhotos.filter(photo => photo.url);
  console.log('📸 [DEBUG] Фото для сохранения:', photosToSave.length);
  
  const socialLinks = state.placeData.social_links || {};
  console.log('🔍 [DEBUG] Соцсети для сохранения:', {
    hasSocialLinks: !!state.placeData.social_links,
    socialLinksType: typeof socialLinks,
    socialLinksCount: Object.keys(socialLinks).length,
    socialLinksData: socialLinks
  });
  
  const placeData = {
    name: state.placeData.name,
    address: state.placeData.address,
    working_hours: state.placeData.working_hours,
    average_price: state.placeData.average_price,
    description: state.placeData.description,
    category_id: state.placeData.category_id,
    category_name: state.placeData.category_name,
    category_emoji: state.placeData.category_emoji,
    website: state.placeData.website,
    phone: state.placeData.phone,
    contacts: state.placeData.contacts,
    map_url: state.placeData.map_url,
    latitude: state.placeData.latitude,
    longitude: state.placeData.longitude,
    google_place_id: state.placeData.google_place_id,
    social_links: socialLinks,
    photos: photosToSave.map(photo => ({
      url: photo.url,
      fileName: photo.fileName,
      uploadedAt: photo.uploadedAt || new Date().toISOString(),
      telegramFileId: photo.telegramFileId
    }))
  };
  
  console.log('💾 [DEBUG] Итоговые данные для сохранения:', {
    name: placeData.name,
    social_links: placeData.social_links,
    social_links_type: typeof placeData.social_links,
    social_links_keys: Object.keys(placeData.social_links || {})
  });
  
  try {
    console.log('💾 [DEBUG] Вызываю placeManager.addPlace...');
    const result = await placeManager.addPlace(state.city, placeData);
    console.log('💾 [DEBUG] Результат addPlace:', result.success ? 'УСПЕХ' : 'ОШИБКА');
    
    if (result.success) {
      const place = result.place;
      
      this.userStates.delete(chatId);
      this.userPhotos.delete(chatId);
      
      let message = `✅ *Место успешно добавлено!*\n\n`;
      message += `🏙️ *Город:* ${state.city}\n`;
      message += `📁 *Категория:* ${place.category_emoji} ${place.category_name}\n`;
      message += `🏛️ *Название:* ${place.name}\n`;
      message += `📍 *Адрес:* ${place.address}\n`;
      message += `⏰ *Время работы:* ${place.working_hours}\n`;
      message += `💰 *Средний чек:* ${place.average_price}\n`;
      
      if (place.social_links && Object.keys(place.social_links).length > 0) {
        message += `📱 *Социальные сети:* ${Object.keys(place.social_links).length} шт. добавлено\n`;
        Object.entries(place.social_links).forEach(([name, url]) => {
          message += `  • ${this.getSocialIcon(url)} ${name}\n`;
        });
      }
      
      if (place.latitude && place.longitude) {
        message += `🌍 *Координаты:* ✅ Сохранены (${place.latitude}, ${place.longitude})\n`;
      } else {
        message += `🌍 *Координаты:* ❌ Не найдены\n`;
      }
      
      if (place.photos && place.photos.length > 0) {
        message += `📷 *Фото:* ${place.photos.length} шт. (сохранены в Firebase)\n`;
      } else {
        message += `📷 *Фото:* не добавлены\n`;
      }
      
      message += `\n📅 *Добавлено:* ${new Date().toLocaleDateString('ru-RU')}`;
      
      await this.sendAdminMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true } 
      });
      
      await this.askNextActionAfterAdd(chatId);
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Ошибка при сохранении места:', error);
    this.userStates.delete(chatId);
    this.userPhotos.delete(chatId);
    await this.sendAdminMessage(
      chatId,
      `❌ Ошибка при добавлении места: ${error.message}`,
      { reply_markup: { remove_keyboard: true } }
    );
    await this.showAdminPanel(chatId);
  }
}

async askNextActionAfterAdd(chatId) {
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '➕ Добавить еще место', callback_data: 'admin_action:add_place' },
        { text: '📋 Посмотреть все места', callback_data: 'admin_action:view_places' }
      ],
      [
        { text: '🏠 В админ-панель', callback_data: 'admin_action:back_to_panel' },
        { text: '❌ Закончить', callback_data: 'admin_action:finish' }
      ]
    ]
  };
  
  await this.sendAdminMessage(
    chatId,
    '📋 *Что вы хотите сделать дальше?*',
    {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    }
  );
}

async extractDataFromMapUrl(mapUrl) {
  try {
    console.log(`🔍 Анализирую ссылку: ${mapUrl.substring(0, 100)}...`);
    
    if (!mapUrl || typeof mapUrl !== 'string') {
      return { success: false, message: 'Ссылка пустая или не строка' };
    }

    let urlToAnalyze = await this.resolveShortUrl(mapUrl);
    console.log(`✅ Раскрытая ссылка (первые 200 символов): ${urlToAnalyze.substring(0, 200)}...`);
    
    const result = {
      success: false,
      latitude: null,
      longitude: null,
      google_place_id: null,
      message: '',
      url_analyzed: urlToAnalyze
    };

    if (urlToAnalyze.includes('google.com/maps') || urlToAnalyze.includes('maps.google.com')) {
      console.log('🗺️ Обнаружена ссылка Google Maps');
      const decodedUrl = decodeURIComponent(urlToAnalyze);
      
      const allCoordsMatches = [...decodedUrl.matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g)];
      console.log(`🔍 Найдено ${allCoordsMatches.length} наборов координат в ссылке`);
      
      if (allCoordsMatches.length > 0) {
        const lastCoordsMatch = allCoordsMatches[allCoordsMatches.length - 1];
        result.latitude = parseFloat(lastCoordsMatch[1]);
        result.longitude = parseFloat(lastCoordsMatch[2]);
        console.log(`✅ Взяты ПОСЛЕДНИЕ координаты из ссылки: ${result.latitude}, ${result.longitude}`);
        result.success = true;
        
        const coordsStartIndex = lastCoordsMatch.index;
        const beforeCoords = decodedUrl.substring(0, coordsStartIndex);
        const placeIdMatches = [...beforeCoords.matchAll(/!1s([^!]+)/g)];
        
        if (placeIdMatches.length > 0) {
          const lastPlaceIdMatch = placeIdMatches[placeIdMatches.length - 1];
          result.google_place_id = lastPlaceIdMatch[1].split('?')[0].split('/')[0];
          console.log(`✅ Place ID найден: ${result.google_place_id}`);
        } else {
          console.log('⚠️ Place ID не найден перед координатами');
        }
      }
      
      if (!result.success) {
        const atMatch = decodedUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (atMatch) {
          result.latitude = parseFloat(atMatch[1]);
          result.longitude = parseFloat(atMatch[2]);
          console.log(`✅ Координаты из @: ${result.latitude}, ${result.longitude}`);
          result.success = true;
        }
      }
      
      if (!result.google_place_id) {
        const placeIdParamMatch = decodedUrl.match(/place_id=([^&]+)/);
        if (placeIdParamMatch) {
          result.google_place_id = placeIdParamMatch[1];
          console.log(`✅ Place ID из place_id=: ${result.google_place_id}`);
        }
      }
      
      if (result.google_place_id) {
        result.google_place_id = result.google_place_id.split('?')[0].split('/')[0];
        const isValidPlaceId = result.google_place_id.length >= 10 && 
          (result.google_place_id.includes(':') || 
           result.google_place_id.startsWith('ChIJ') ||
           result.google_place_id.startsWith('0x'));
        if (!isValidPlaceId) {
          console.log(`⚠️ Полученный Place ID невалидный: ${result.google_place_id}`);
          result.google_place_id = null;
        }
      }
    }
    else if (urlToAnalyze.includes('yandex.ru/maps') || urlToAnalyze.includes('yandex.com/maps')) {
      console.log('🗺️ Обнаружена ссылка Яндекс.Карты');
      const decodedUrl = decodeURIComponent(urlToAnalyze);
      const llMatch = decodedUrl.match(/ll=([^&]+)/);
      if (llMatch) {
        const coords = llMatch[1].split(',');
        if (coords.length >= 2) {
          result.longitude = parseFloat(coords[0]);
          result.latitude = parseFloat(coords[1]);
          console.log(`✅ Координаты из ll: ${result.latitude}, ${result.longitude}`);
          result.success = true;
        }
      }
    }
    
    if (result.latitude && result.longitude) {
      if (result.latitude < -90 || result.latitude > 90 || 
          result.longitude < -180 || result.longitude > 180) {
        result.message = 'Координаты вне допустимого диапазона';
        result.success = false;
        result.latitude = null;
        result.longitude = null;
      } else {
        result.message = 'Данные успешно извлечены';
        console.log(`🎯 Успешно извлечены: lat=${result.latitude}, lon=${result.longitude}, place_id=${result.google_place_id || 'НЕТ'}`);
      }
    } else {
      result.message = 'Не удалось извлечь координаты из ссылки';
    }
    
    return result;
  } catch (error) {
    console.error('❌ Критическая ошибка в extractDataFromMapUrl:', error);
    return { success: false, message: `Ошибка обработки: ${error.message}` };
  }
}

async resolveShortUrl(shortUrl) {
  try {
    console.log(`🔗 Раскрываю короткую ссылку: ${shortUrl.substring(0, 50)}...`);
    
    if (!shortUrl.includes('goo.gl') && !shortUrl.includes('maps.app.goo.gl')) {
      return shortUrl;
    }
    
    const axios = require('axios');
    const response = await axios.get(shortUrl, {
      maxRedirects: 10,
      timeout: 10000,
      validateStatus: function (status) {
        return status < 400;
      }
    });
    
    const finalUrl = response.request.res.responseUrl || response.config.url;
    console.log(`✅ Раскрытая ссылка (${finalUrl.length} символов): ${finalUrl.substring(0, 100)}...`);
    return finalUrl;
  } catch (error) {
    console.error('❌ Ошибка раскрытия короткой ссылки:', error.message);
    try {
      const axios = require('axios');
      const response = await axios.head(shortUrl, { maxRedirects: 5, timeout: 5000 });
      if (response.request && response.request.res && response.request.res.responseUrl) {
        return response.request.res.responseUrl;
      }
    } catch (secondError) {
      console.error('❌ Вторая попытка тоже не удалась:', secondError.message);
    }
    return shortUrl;
  }
}

async uploadPhotosToFirebase(photoFileIds) {
  const uploadedPhotos = [];
  
  if (!this.firebaseStorage || !this.firebaseStorage.initialized) {
    console.log('⚠️ Firebase Storage недоступен для загрузки фото');
    return [];
  }
  
  for (const fileId of photoFileIds) {
    try {
      const result = await this.firebaseStorage.uploadPhotoFromTelegram(fileId, this.botToken);
      if (result.success) {
        uploadedPhotos.push({
          url: result.url,
          fileName: result.fileName,
          uploadedAt: Date.now()
        });
        console.log(`✅ Фото загружено в Firebase: ${result.url}`);
      }
    } catch (error) {
      console.error(`❌ Ошибка загрузки фото ${fileId}:`, error);
    }
  }
  
  return uploadedPhotos;
}

async processFieldEdit(chatId, text, state) {
  try {
    const { cityKey, placeId, editingField } = state;
    const cityName = await this.getCityNameFromKey(cityKey);
    let newValue = text;

    if (newValue === '-') {
      newValue = '';
    }

    if (text === '📱 Открыть редактор соцсетей') {
      this.userStates.delete(chatId);
      await this.handleEditSocialLinks(chatId, cityKey, placeId);
      return;
    }

    switch(editingField) {
      case 'latitude':
      case 'longitude':
        if (newValue !== '') {
          const numValue = parseFloat(newValue.replace(',', '.'));
          if (isNaN(numValue)) {
            await this.bot.sendMessage(chatId, '❌ Пожалуйста, введите числовое значение.');
            return;
          }
          if (editingField === 'latitude' && (numValue < -90 || numValue > 90)) {
            await this.bot.sendMessage(chatId, '❌ Широта должна быть от -90 до 90 градусов.');
            return;
          }
          if (editingField === 'longitude' && (numValue < -180 || numValue > 180)) {
            await this.bot.sendMessage(chatId, '❌ Долгота должна быть от -180 до 180 градусов.');
            return;
          }
          newValue = numValue;
        }
        break;
        
      case 'average_price':
        if (newValue !== '' && !isNaN(parseInt(newValue))) {
          const numValue = parseInt(newValue);
          if (numValue < 0) {
            await this.bot.sendMessage(chatId, '❌ Введите положительную сумму.');
            return;
          }
        }
        break;
        
      case 'website':
        if (newValue !== '') {
          if (!newValue.startsWith('http://') && !newValue.startsWith('https://')) {
            newValue = 'https://' + newValue;
          }
          try { new URL(newValue); } catch (error) {
            await this.bot.sendMessage(chatId, '❌ Неверный формат URL.');
            return;
          }
        }
        break;
        
      case 'phone':
        if (newValue !== '') {
          const phoneRegex = /^[+\d\s\-\(\)\.]{5,20}$/;
          if (!phoneRegex.test(newValue)) {
            await this.bot.sendMessage(chatId, '❌ Неверный формат номера телефона.\n\nПримеры: +7 (999) 123-45-67, 89991234567');
            return;
          }
        }
        break;
        
      case 'map_url':
        if (newValue !== '') {
          try { new URL(newValue); } catch (error) {
            await this.bot.sendMessage(chatId, '❌ Неверный формат URL.');
            return;
          }
        }
        break;
        
      case 'social_links':
        let socialLinks = {};
        if (newValue !== '') {
          const lines = newValue.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const firstColonIndex = line.indexOf(': ');
            if (firstColonIndex === -1) {
              const simpleColonIndex = line.indexOf(':');
              if (simpleColonIndex === -1) {
                await this.bot.sendMessage(chatId, `❌ Неверный формат строки: "${line}". Используйте: Название: URL`);
                return;
              }
              const name = line.substring(0, simpleColonIndex).trim();
              const url = line.substring(simpleColonIndex + 1).trim();
              if (name && url) {
                const normalizedUrl = this.normalizeSocialUrl(url);
                if (this.isValidSocialUrl(normalizedUrl)) {
                  socialLinks[name] = normalizedUrl;
                } else {
                  await this.bot.sendMessage(chatId, `❌ Неверный URL для "${name}".`);
                  return;
                }
              }
            } else {
              const name = line.substring(0, firstColonIndex).trim();
              const url = line.substring(firstColonIndex + 1).trim();
              if (name && url) {
                const normalizedUrl = this.normalizeSocialUrl(url);
                if (this.isValidSocialUrl(normalizedUrl)) {
                  socialLinks[name] = normalizedUrl;
                } else {
                  await this.bot.sendMessage(chatId, `❌ Неверный URL для "${name}".`);
                  return;
                }
              }
            }
          }
        }
        newValue = socialLinks;
        break;
        
      case 'google_place_id':
        if (newValue !== '') {
          const placeIdRegex = /^[A-Za-z0-9_-]{27,}$/;
          if (!placeIdRegex.test(newValue)) {
            await this.bot.sendMessage(chatId, '❌ Неверный формат Google Place ID.');
            return;
          }
        }
        break;
        
      case 'name':
        if (newValue.length < 2) {
          await this.bot.sendMessage(chatId, '❌ Название должно содержать минимум 2 символа.');
          return;
        }
        break;
        
      case 'address':
        if (newValue.length < 5) {
          await this.bot.sendMessage(chatId, '❌ Адрес должен содержать минимум 5 символов.');
          return;
        }
        break;
        
      case 'description':
        if (newValue.length < 10) {
          await this.bot.sendMessage(chatId, '❌ Описание должно содержать минимум 10 символов.');
          return;
        }
        break;
    }

    const updateData = { [editingField]: newValue };
    const result = await placeManager.updatePlace(cityName, placeId, updateData);

    if (result.success) {
      this.userStates.delete(chatId);
      let successMessage = `✅ Поле "${this.fieldLabels[editingField] || editingField}" успешно обновлено!`;
      if (editingField === 'social_links') {
        if (Object.keys(newValue).length > 0) {
          successMessage += `\n\n📱 *Добавлено соцсетей:* ${Object.keys(newValue).length}\n`;
          Object.entries(newValue).forEach(([name, url]) => {
            successMessage += `• ${this.getSocialIcon(url)} ${name}\n`;
          });
        } else {
          successMessage += '\n\n📭 Социальные сети удалены.';
        }
      }
      await this.bot.sendMessage(chatId, successMessage, {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true }
      });
      setTimeout(async () => {
        await this.showPlaceDetails(chatId, cityKey, placeId);
      }, 1000);
    } else {
      throw new Error(result.message || 'Неизвестная ошибка при обновлении');
    }
  } catch (error) {
    console.error('❌ Ошибка при сохранении:', error);
    await this.bot.sendMessage(chatId, `❌ Ошибка при сохранении: ${error.message}`);
    this.userStates.delete(chatId);
  }
}

async finishAddingCity(chatId, state) {
  console.log('🏁 Начинаю завершение добавления города...');
  
  let photoUrl = null;
  let photoFileName = null;
  
  // 📸 Загружаем фото в Firebase если оно есть
  if (state.photoFileId && this.firebaseStorage && this.firebaseStorage.initialized) {
    try {
      console.log('☁️ Загружаю фото города в Firebase...');
      
      const firebaseResult = await this.firebaseStorage.uploadPhotoFromTelegram(
        state.photoFileId,
        this.botToken
      );
      
      if (firebaseResult.success) {
        photoUrl = firebaseResult.url;
        photoFileName = firebaseResult.fileName;
        console.log(`✅ Фото города загружено в Firebase: ${photoUrl}`);
      } else {
        console.log(`❌ Не удалось загрузить фото в Firebase:`, firebaseResult.error);
      }
    } catch (error) {
      console.error(`❌ Ошибка при загрузке фото в Firebase:`, error);
    }
  } else if (state.photoFileId) {
    console.log('⚠️ Firebase Storage не доступен, сохраняю только file_id');
  }
  
  // 🔥 FIREBASE-FIRST: Сначала сохраняем в Firebase
  let firebaseResult = null;
  if (this.firebaseDB && this.firebaseDB.initialized) {
    try {
      firebaseResult = await this.firebaseDB.addCity(state.cityName, {
        photoFileId: state.photoFileId,
        photoUrl: photoUrl,
        photoFileName: photoFileName,
        createdAt: Date.now(),
        createdBy: 'bot'
      });
      
      console.log(`✅ Город "${state.cityName}" добавлен в Firebase:`, firebaseResult);
    } catch (firebaseError) {
      console.error('❌ Ошибка добавления города в Firebase:', firebaseError);
    }
  }
  
  // 🏙️ Также добавляем город в локальные файлы (для совместимости)
  const localResult = await cityManager.addCity(state.cityName, {
    photoFileId: state.photoFileId,
    photoUrl: photoUrl,
    photoFileName: photoFileName
  });
  
  if (localResult.success) {
    let message = `✅ Город "${localResult.cityName}" успешно добавлен!\n\n`;
    
    if (firebaseResult && firebaseResult.success) {
      message += `☁️ *Данные сохранены в Firebase*\n`;
    } else {
      message += `📁 *Данные сохранены в локальных файлах*\n`;
      message += `(Firebase временно недоступен)\n`;
    }
    
    message += `📁 Файл: \`${localResult.fileName}\`\n`;
    
    if (photoUrl) {
      message += `📸 Фото: загружено в Firebase Storage\n`;
    } else if (state.photoFileId) {
      message += `📸 Фото: сохранено (file_id: ${state.photoFileId})\n`;
    } else {
      message += `📸 Фото: не добавлено\n`;
    }
    
    await this.sendAdminMessage(chatId, message, { parse_mode: 'Markdown' });
  } else {
    await this.sendAdminMessage(chatId, `❌ ${localResult.message}`);
  }
  
  this.userStates.delete(chatId);
  await this.showAdminPanel(chatId);
}

  isUserAdmin(userId) {
    return this.adminIds.includes(userId);
  }

       isMainMenuCommand(text) {
        const mainMenuCommands = [
            '🏙️ Выбрать город',
            '📰 Новости',
            '📱 Наши медиа',
            '⚙️ Администрирование',
            '🔙 Назад',
            '🏠 Главное меню'
        ];
        return mainMenuCommands.includes(text);
    }
    // Добавьте этот метод
async fixPlaceWorkingHours(chatId, placeId) {
  try {
    // Найти место
    const cities = await cityManager.getAllCities();
    let foundPlace = null;
    let foundCity = null;
    
    for (const city of cities) {
      const place = await placeManager.getPlaceById(city, placeId);
      if (place) {
        foundPlace = place;
        foundCity = city;
        break;
      }
    }
    
    if (!foundPlace) {
      await this.sendAdminMessage(chatId, '❌ Место не найдено');
      return;
    }
    
    console.log(`🔍 Исправляю рабочие часы для: ${foundPlace.name}`);
    console.log(`📅 Исходные часы: "${foundPlace.working_hours}"`);
    
    // Очищаем рабочие часы
    const cleanedHours = this.cleanWorkingHours(foundPlace.working_hours);
    
    console.log(`✅ Очищенные часы: "${cleanedHours}"`);
    
    // Обновляем место
    const updateData = { working_hours: cleanedHours };
    const result = await placeManager.updatePlace(foundCity, placeId, updateData);
    
    if (result.success) {
      await this.sendAdminMessage(
        chatId,
        `✅ Рабочие часы исправлены!\n\n` +
        `*Место:* ${foundPlace.name}\n` +
        `*Было:* ${foundPlace.working_hours}\n` +
        `*Стало:* ${cleanedHours}\n\n` +
        `Попробуйте посмотреть место снова.`
      );
      
      // Показываем исправленное место
      setTimeout(async () => {
        const cityKey = this.getCityKey(foundCity);
        await this.showPlaceDetails(chatId, cityKey, placeId);
      }, 1000);
    } else {
      await this.sendAdminMessage(chatId, `❌ Ошибка: ${result.message}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка исправления:', error);
    await this.sendAdminMessage(chatId, `❌ Ошибка: ${error.message}`);
  }
}


    async handleMainMenuCommand(chatId, command, isAdmin) {
        console.log(`🔧 [handleMainMenuCommand] Обрабатываю: ${command} для ${chatId}, админ: ${isAdmin}`);
        
        switch(command) {
            case '🏙️ Выбрать город':
                console.log(`🔧 Переход к выбору города...`);
                this.userStates.delete(chatId);
                this.adminSessions.delete(chatId);
                await this.showCitySelection(chatId, isAdmin);
                break;
                
            case '📰 Новости':
                console.log(`🔧 Показываю новости...`);
                this.userStates.delete(chatId);
                this.adminSessions.delete(chatId);
                await this.showNews(chatId, isAdmin);
                break;
                
            case '📱 Наши медиа':
                console.log(`🔧 Показываю медиа...`);
                this.userStates.delete(chatId);
                this.adminSessions.delete(chatId);
                await this.showMediaLinks(chatId, isAdmin);
                break;
                
            case '⚙️ Администрирование':
                console.log(`🔧 Показываю админ-панель...`);
                if (isAdmin) {
                    try {
                        this.adminSessions.set(chatId, true);
                        await this.showAdminPanel(chatId);
                    } catch (error) {
                        console.error('❌ Ошибка при открытии админ-панели:', error);
                        await this.sendAdminMessage(chatId, '❌ Ошибка при загрузке админ-панели: ' + error.message);
                    }
                } else {
                    await this.sendAdminMessage(chatId, '⛔ У вас нет доступа к этой функции.');
                }
                break;
                
            case '🔙 Назад':
            case '🏠 Главное меню':
                console.log(`🔧 Возвращаюсь в главное меню...`);
                this.userStates.delete(chatId);
                this.adminSessions.delete(chatId);
                this.userPhotos.delete(chatId);
                this.lastBotMessages.delete(chatId);
                await this.showMainMenu(chatId, 'Главное меню:', isAdmin);
                break;
        }
    }

// Метод для обработки редактирования поля соцсети
async handleEditingSocialField(chatId, msg, state) {
  const text = msg.text;
  
  if (text === '/cancel' || text.toLowerCase() === 'отмена') {
    this.userStates.delete(chatId);
    await this.handleEditSocialLinks(chatId, state.cityKey, state.placeId);
    return;
  }
  
  const cityName = await this.getCityNameFromKey(state.cityKey);
  const place = state.placeData;
  let updateData = {};
  
  if (state.field === 'website') {
    if (text === '-') {
      updateData.website = null;
    } else {
      const normalizedUrl = this.normalizeSocialUrl(text);
      if (!this.isValidSocialUrl(normalizedUrl)) {
        await this.sendAdminMessage(
          chatId,
          '❌ Неверный формат URL.\n\n' +
          'Пожалуйста, введите корректный URL (например: https://example.com):'
        );
        return;
      }
      updateData.website = normalizedUrl;
    }
  } else if (state.field === 'add_social') {
    // Парсим введенные данные
    const parts = text.split(':').map(part => part.trim());
    if (parts.length < 2) {
      await this.sendAdminMessage(
        chatId,
        '❌ Неверный формат.\n\n' +
        'Используйте формат: Название:URL\n' +
        'Пример: Instagram: https://instagram.com/place\n\n' +
        'Пожалуйста, введите заново:'
      );
      return;
    }
    
    const name = parts[0];
    const url = parts.slice(1).join(':').trim();
    const normalizedUrl = this.normalizeSocialUrl(url);
    
    if (!this.isValidSocialUrl(normalizedUrl)) {
      await this.sendAdminMessage(
        chatId,
        `❌ Неверный URL для "${name}".\n\n` +
        'Пожалуйста, введите корректный URL:'
      );
      return;
    }
    
    // Добавляем новую соцсеть
    const socialLinks = place.social_links ? { ...place.social_links } : {};
    socialLinks[name] = normalizedUrl;
    updateData.social_links = socialLinks;
  }
  
  // Сохраняем изменения
  const result = await placeManager.updatePlace(cityName, state.placeId, updateData);
  
  if (result.success) {
    await this.sendAdminMessage(
      chatId,
      `✅ Изменения сохранены!`,
      { parse_mode: 'Markdown' }
    );
    
    // Возвращаемся к редактированию соцсетей
    this.userStates.delete(chatId);
    setTimeout(async () => {
      await this.handleEditSocialLinks(chatId, state.cityKey, state.placeId);
    }, 1000);
  } else {
    await this.sendAdminMessage(chatId, `❌ Ошибка: ${result.message}`);
  }
}

// Метод для обработки редактирования конкретной соцсети
async handleEditingSocialItem(chatId, msg, state) {
  const text = msg.text;
  
  if (text === '/cancel' || text.toLowerCase() === 'отмена') {
    this.userStates.delete(chatId);
    await this.handleEditSocialLinks(chatId, state.cityKey, state.placeId);
    return;
  }
  
  const cityName = await this.getCityNameFromKey(state.cityKey);
  const place = state.placeData;
  
  if (!place.social_links) {
    await this.sendAdminMessage(chatId, '❌ Ошибка: соцсети не найдены.');
    return;
  }
  
  const socialLinks = { ...place.social_links };
  
  if (text === '-') {
    // Удаляем соцсеть
    delete socialLinks[state.socialName];
  } else {
    // Обновляем URL
    const normalizedUrl = this.normalizeSocialUrl(text);
    if (!this.isValidSocialUrl(normalizedUrl)) {
      await this.sendAdminMessage(
        chatId,
        '❌ Неверный формат URL.\n\n' +
        'Пожалуйста, введите корректный URL:'
      );
      return;
    }
    socialLinks[state.socialName] = normalizedUrl;
  }
  
  // Сохраняем изменения
  const updateData = { social_links: socialLinks };
  const result = await placeManager.updatePlace(cityName, state.placeId, updateData);
  
  if (result.success) {
    await this.sendAdminMessage(
      chatId,
      `✅ Изменения сохранены!`,
      { parse_mode: 'Markdown' }
    );
    
    // Возвращаемся к редактированию соцсетей
    this.userStates.delete(chatId);
    setTimeout(async () => {
      await this.handleEditSocialLinks(chatId, state.cityKey, state.placeId);
    }, 1000);
  } else {
    await this.sendAdminMessage(chatId, `❌ Ошибка: ${result.message}`);
  }
}


async migrateAllDataToFirebase(chatId) {
  try {
    await this.sendAdminMessage(
      chatId,
      '🚀 *Начинаю полную миграцию данных в Firebase...*\n\n' +
      'Это может занять несколько минут. Пожалуйста, подождите.',
      { parse_mode: 'Markdown' }
    );
    
    let report = '';
    let totalMigrated = 0;
    
    // 1. Миграция городов
    const cities = await cityManager.getAllCities();
    report += `🏙️ *Города:* ${cities.length}\n`;
    
    for (const city of cities) {
      try {
        await this.firebaseDB.syncCity(city);
        totalMigrated++;
        report += `  ✅ ${city}\n`;
      } catch (error) {
        report += `  ❌ ${city}: ${error.message}\n`;
      }
    }
    
    // 2. Миграция категорий
    const categories = await categoryManager.getAllCategories();
    report += `\n📁 *Категории:* ${categories.length}\n`;
    
    for (const category of categories) {
      try {
        await this.firebaseDB.syncCategory(category);
        totalMigrated++;
        report += `  ✅ ${category.emoji} ${category.name}\n`;
      } catch (error) {
        report += `  ❌ ${category.name}: ${error.message}\n`;
      }
    }
    
    // 3. Миграция мест
    let placesMigrated = 0;
    report += `\n📍 *Места:*\n`;
    
    for (const city of cities) {
      const places = await placeManager.getPlacesByCity(city);
      report += `  🏙️ ${city}: ${places.length} мест\n`;
      
      for (const place of places) {
        try {
          await this.firebaseDB.syncPlace(city, place);
          placesMigrated++;
          totalMigrated++;
        } catch (error) {
          report += `    ❌ ${place.name}: ${error.message}\n`;
        }
      }
    }
    
    report += `    ✅ Успешно мигрировано: ${placesMigrated} мест\n`;
    
    // 4. Миграция рекламы
    const ads = await adsManager.getAllAds();
    report += `\n📢 *Рекламные объявления:* ${ads.length}\n`;
    
    for (const ad of ads) {
      try {
        await this.firebaseDB.syncAd(ad);
        totalMigrated++;
        report += `  ✅ ${ad.text.substring(0, 30)}...\n`;
      } catch (error) {
        report += `  ❌ Ошибка: ${error.message}\n`;
      }
    }
    
    const finalMessage = `✅ *Миграция завершена!*\n\n` +
      `📊 *Итоги:*\n` +
      `• Всего объектов: ${totalMigrated}\n` +
      `• Городов: ${cities.length}\n` +
      `• Категорий: ${categories.length}\n` +
      `• Мест: ${placesMigrated}\n` +
      `• Рекламы: ${ads.length}\n\n` +
      `*Детальный отчет:*\n${report}`;
    
    await this.sendAdminMessage(chatId, finalMessage, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    await this.sendAdminMessage(
      chatId,
      `❌ Критическая ошибка миграции: ${error.message}`
    );
  }
}
// ============ ИСПРАВЛЕННЫЙ МЕТОД ДЛЯ UBER ============

// Генерация ссылки на Uber (только HTTP/HTTPS для Telegram)
generateUberLink(place) {
  if (!place.latitude || !place.longitude) {
    console.log('🚗 Нет координат для Uber');
    return null;
  }
  
  console.log('🚗 [DEBUG Uber] Генерирую ссылку с данными:', {
    name: place.name,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    google_place_id: place.google_place_id
  });
  
  const encodedName = encodeURIComponent(place.name || 'Место назначения');
  
  // ✅ ИСПРАВЛЕНИЕ: Используем HTTPS Universal Link вместо deeplink
  // Этот формат работает везде и автоматически откроет приложение если оно установлено
  
  // Если есть Google Place ID - используем его
  if (place.google_place_id) {
    const uberLink = `https://m.uber.com/ul/?action=setPickup` +
                    `&pickup=my_location` +
                    `&dropoff[latitude]=${place.latitude}` +
                    `&dropoff[longitude]=${place.longitude}` +
                    `&dropoff[nickname]=${encodedName}` +
                    `&dropoff[place_id]=${encodeURIComponent(place.google_place_id)}`;
    
    console.log(`🚗 Universal Link с Place ID: ${uberLink}`);
    return uberLink;
  }
  
  // Без Place ID - только координаты
  const uberLink = `https://m.uber.com/ul/?action=setPickup` +
                  `&pickup=my_location` +
                  `&dropoff[latitude]=${place.latitude}` +
                  `&dropoff[longitude]=${place.longitude}` +
                  `&dropoff[nickname]=${encodedName}`;
  
  console.log(`🚗 Universal Link без Place ID: ${uberLink}`);
  return uberLink;
}

// Метод для получения ссылки Uber с приоритетом старых данных
getUberLinkForPlace(place) {
  try {
    // Генерируем deeplink - он будет работать на мобильных устройствах
    const link = this.generateUberLink(place);
    
    if (!link) {
      console.log('🚗 Не удалось создать ссылку Uber');
      return null;
    }
    
    return link;
    
  } catch (error) {
    console.error('🚗 Ошибка при создании ссылки Uber:', error);
    return null;
  }
}
// Альтернативная простая версия (если сложная не работает)
generateUberSimpleLink(place) {
  if (!place.latitude || !place.longitude) {
    return null;
  }
  
  // Простая ссылка с координатами и названием
  const encodedName = encodeURIComponent(place.name || 'Место');
  return `https://m.uber.com/ul/?action=setDropoff&dropoff[latitude]=${place.latitude}&dropoff[longitude]=${place.longitude}&dropoff[nickname]=${encodedName}`;
}

// Умная ссылка, которая пробует разные форматы
generateSmartUberLink(place) {
  if (!place.latitude || !place.longitude) {
    return null;
  }
  
  // Возвращаем deeplink - Telegram на мобильных устройствах откроет приложение
  // На десктопе можно добавить кнопку с веб-версией отдельно
  return this.generateUberLink(place);
}

// Прямой deeplink для приложения Uber (может открыть приложение)
generateUberDeepLink(place) {
  if (!place.latitude || !place.longitude) {
    return null;
  }
  
  // Deeplink для прямого открытия приложения
  const encodedName = encodeURIComponent(place.name || 'Место');
  return `uber://?action=setDropoff&dropoff[latitude]=${place.latitude}&dropoff[longitude]=${place.longitude}&dropoff[nickname]=${encodedName}`;
}

// Улучшенный метод для Uber с выбором формата
generateUberLinkImproved(place) {
  if (!place.latitude || !place.longitude) {
    return null;
  }
  
  // Проверяем, есть ли все необходимые данные для старого формата
  if (place.name && place.address && place.google_place_id) {
    console.log(`🚗 Используем старый формат с полными данными`);
    return this.generateUberLink(place);
  }
  
  // Если нет полных данных, используем простой формат
  console.log(`🚗 Используем простой формат с координатами`);
  return this.generateUberSimpleLink(place);
}



// Метод для тестирования Uber ссылок
async testUberLink(chatId, place) {
  if (!place.latitude || !place.longitude) {
    await this.sendAdminMessage(chatId, '❌ Нет координат для теста Uber');
    return;
  }
  
  const oldLink = this.generateUberLink(place);
  const simpleLink = this.generateUberSimpleLink(place);
  const deeplink = this.generateUberDeepLink(place);
  
  let message = `🚗 *Тест ссылок Uber*\n\n`;
  message += `📍 *Место:* ${place.name}\n`;
  message += `🌍 *Координаты:* ${place.latitude}, ${place.longitude}\n`;
  message += `📌 *Адрес:* ${place.address || 'нет'}\n`;
  message += `🏷️ *Google Place ID:* ${place.google_place_id || 'нет'}\n\n`;
  
  message += `*Ссылки:*\n`;
  message += `1. *Старый формат:*\n\`${oldLink}\`\n\n`;
  message += `2. *Простой формат:*\n\`${simpleLink}\`\n\n`;
  message += `3. *Deeplink:*\n\`${deeplink}\``;
  
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '🚗 Старый формат', url: oldLink },
        { text: '🚗 Простой формат', url: simpleLink }
      ],
      [
        { text: '📱 Deeplink', url: deeplink }
      ],
      [
        { text: '🔙 Назад', callback_data: 'admin_action:back_to_panel' }
      ]
    ]
  };
  
  await this.sendAdminMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}
// Метод для проверки, что URL безопасен для Telegram
isTelegramSafeUrl(url) {
  if (!url || typeof url !== 'string') {
    console.warn('⚠️ Пустой URL при проверке безопасности');
    return false;
  }
  
  const trimmed = url.trim();
  
  // Telegram поддерживает только HTTP и HTTPS
  const allowedProtocols = ['http://', 'https://'];
  
  const hasAllowedProtocol = allowedProtocols.some(protocol => 
    trimmed.toLowerCase().startsWith(protocol)
  );
  
  if (!hasAllowedProtocol) {
    console.error(`❌ Telegram не поддерживает протокол в URL: ${trimmed.substring(0, 50)}...`);
    return false;
  }
  
  return true;
}
// Дополнительная очистка inline-кнопок

// Альтернативная версия с более простыми параметрами
generateUberSimpleLink(place) {
  if (!place.latitude || !place.longitude) {
    return null;
  }
  
  // Самый простой и надежный вариант
  const simpleLink = `https://m.uber.com/ul/?action=setDropoff&dropoff[latitude]=${place.latitude}&dropoff[longitude]=${place.longitude}&dropoff[nickname]=${encodeURIComponent(place.name || 'Место')}`;
  console.log(`🚗 Простая ссылка Uber: ${simpleLink}`);
  
  return simpleLink;
}

// Прямой deeplink для приложения Uber
generateUberDeepLink(place) {
  if (!place.latitude || !place.longitude) {
    return null;
  }
  
  // Deeplink для прямого открытия приложения Uber
  const deeplink = `uber://?action=setDropoff&dropoff[latitude]=${place.latitude}&dropoff[longitude]=${place.longitude}&dropoff[nickname]=${encodeURIComponent(place.name || 'Место')}`;
  console.log(`📱 Deeplink Uber: ${deeplink}`);
  
  return deeplink;
}

// Умная ссылка: пробует deeplink, потом web
generateSmartUberLink(place) {
  // На мобильных устройствах Telegram пробует сначала deeplink
  // Если приложение не установлено, откроется web-версия
  
  const deeplink = this.generateUberDeepLink(place);
  const webLink = this.generateUberSimpleLink(place);
  
  // Telegram поддерживает специальный формат для нескольких URL
  // Но в простом случае используем универсальную ссылку
  console.log(`🔗 Умная ссылка: предпочитаем веб-версию для кросс-платформенности`);
  return webLink;
}

generateUberWebLink(place) {
  if (!place.latitude || !place.longitude) {
    return null;
  }
  
  const encodedName = encodeURIComponent(place.name || 'Место');
  
  // Универсальная веб-ссылка Uber
  const webLink = `https://m.uber.com/ul/?action=setPickup` +
                 `&pickup=my_location` +
                 `&dropoff[latitude]=${place.latitude}` +
                 `&dropoff[longitude]=${place.longitude}` +
                 `&dropoff[nickname]=${encodedName}`;
  
  return webLink;
}

// Расширенная версия с дополнительными возможностями (без deeplink)
async showUberOptions(chatId, place, cityKey) {
  if (!place.latitude || !place.longitude) {
    return null;
  }
  
  const message = `🚗 *Вызов такси Uber*\n\n` +
    `📍 *Куда:* ${place.name}\n` +
    `📌 *Адрес:* ${place.address || 'адрес не указан'}\n\n` +
    `*Выберите вариант:*`;
  
  const inlineKeyboard = {
    inline_keyboard: []
  };
  
  // Только веб-версия (без deeplink)
  const uberLink = this.getUberLinkForPlace(place);
  if (uberLink) {
    inlineKeyboard.inline_keyboard.push([
      { 
        text: '🚗 Вызвать Uber', 
        url: uberLink 
      }
    ]);
  }
  
  // Маршрут в Google Maps
  inlineKeyboard.inline_keyboard.push([
    { 
      text: '🗺️ Построить маршрут', 
      url: `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&travelmode=driving` 
    }
  ]);
  
  // Копировать координаты
  inlineKeyboard.inline_keyboard.push([
    { 
      text: '📋 Скопировать координаты', 
      callback_data: `copy_coords:${place.latitude}:${place.longitude}` 
    }
  ]);
  
  // Назад к месту
  inlineKeyboard.inline_keyboard.push([
    { 
      text: '🔙 Назад к месту', 
      callback_data: `show_place:${cityKey}:${place.id}` 
    }
  ]);
  
  await this.sendAndTrack(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}

// Обработчик для копирования координат
async handleCopyCoords(chatId, latitude, longitude) {
  const coords = `${latitude},${longitude}`;
  
  await this.sendAndTrack(
    chatId,
    `📍 *Координаты для навигации:*\n\n` +
    `\`${coords}\`\n\n` +
    `*Инструкция:*\n` +
    `1. Нажмите на координаты выше для выделения\n` +
    `2. Нажмите "Копировать"\n` +
    `3. Вставьте в любое навигационное приложение`,
    { parse_mode: 'Markdown' }
  );
}
escapeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Сохраняем переносы строк
  const lines = text.split('\n');
  const escapedLines = lines.map(line => {
    // Обрабатываем каждую строку отдельно
    return line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;')
      // Удаляем непечатаемые символы, но сохраняем обычные пробелы и табуляции
      .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F\u2000-\u200F\u2028-\u202F\u205F-\u206F\uFEFF]/g, '')
      .trim();
  });
  
  // Соединяем обратно с переносами строк
  return escapedLines.join('\n');
}

cleanWorkingHours(text) {
  if (!text || typeof text !== 'string') return 'не указано';
  
  // Сохраняем переносы строк
  const lines = text.split('\n');
  const cleanedLines = lines.map(line => {
    // Удаляем непечатаемые символы, но сохраняем пробелы
    return line
      .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F\u2000-\u200F\u2028-\u202F\u205F-\u206F\uFEFF]/g, '')
      .trim();
  });
  
  // Фильтруем пустые строки и соединяем
  return cleanedLines.filter(line => line.length > 0).join('\n');
}

async showPlaceDetails(chatId, cityKey, placeId, userId = null) {
  try {
    const cityName = await this.getCityNameFromKey(cityKey);
    const place = await placeManager.getPlaceById(cityName, placeId);

    if (!userId) {
      const userState = this.userStates.get(chatId);
      userId = userState?.userId || chatId;
    }

    if (!place) {
      await this.sendAndTrack(chatId, '❌ Место не найдено.');
      return;
    }

    const category = await categoryManager.getCategoryById(place.category_id);

    // 🖼️ ПОЛУЧАЕМ URL ПЕРВОГО ФОТО ДЛЯ ПРЕВЬЮ
let photoUrl = null;

if (place.photos && Array.isArray(place.photos) && place.photos.length > 0) {
  const photo = place.photos[0];
  if (photo && typeof photo === 'object' && photo.url) {
    photoUrl = photo.url;
  } else if (typeof photo === 'string' && photo.startsWith('http')) {
    photoUrl = photo;
  }
}

// ✅ ФОРМИРУЕМ СООБЩЕНИЕ С БЕЗОПАСНЫМ HTML
let message = '';

// ✅ ИСПРАВЛЕНИЕ: экранируем URL для атрибута href
if (photoUrl) {
  const escapedUrl = this.escapeHtmlAttribute(photoUrl);
  message += `<a href="${escapedUrl}">&#8203;</a>`;
}

// 🔥 Безопасный HTML текст (экранируем все поля)
const safeName = this.escapeHtml(place.name);
const safeCategoryName = this.escapeHtml(category.name);
const safeAddress = place.address ? this.escapeHtml(place.address) : 'не указан';
const safeHours = place.working_hours ? this.cleanWorkingHours(place.working_hours) : 'не указано';
const safePrice = place.average_price ? this.escapeHtml(place.average_price) : null;
const safeDescription = place.description ? this.escapeHtml(place.description) : 'Нет описания';
const safePhone = place.phone ? this.escapeHtml(place.phone) : null;

message += `🏛️ <b>${safeName}</b>\n`;
message += `📁 ${category.emoji} ${safeCategoryName}\n\n`;
message += `📍 <b>Адрес:</b> ${safeAddress}\n`;
message += `⏰ <b>Время работы:</b> ${safeHours}\n`;

if (safePrice) {
  message += `💰 <b>Средний чек:</b> ${safePrice}\n`;
}

message += `\n📝 <b>Описание:</b>\n${safeDescription}\n`;

if (safePhone) {
  message += `\n📞 <b>Телефон:</b> ${safePhone}\n`;
}
    // Остальной код без изменений...
    const socialLinks = this.getValidSocialLinks(place);
    
    if (socialLinks && Object.keys(socialLinks).length > 0) {
      message += `\n📱 <b>Социальные сети:</b>\n`;
      Object.entries(socialLinks).forEach(([name, url]) => {
        const icon = this.getSocialIcon(url);
        message += `• ${icon} : ${url}\n`;
      });
    }

    const inlineKeyboard = {
      inline_keyboard: []
    };

    // КНОПКИ СОЦСЕТЕЙ
    if (socialLinks && Object.keys(socialLinks).length > 0) {
      const socialEntries = Object.entries(socialLinks);
      
      for (let i = 0; i < socialEntries.length; i += 2) {
        const row = socialEntries.slice(i, i + 2).map(([name, url]) => {
          const icon = this.getSocialIcon(url);
          const normalizedUrl = this.normalizeSocialUrl(url);
          
          if (!normalizedUrl || normalizedUrl.trim() === '') {
            return null;
          }
          
          const urlToUse = normalizedUrl.startsWith('http') ? normalizedUrl : `https://${normalizedUrl}`;
          
          return {
            text: `${icon}`,
            url: urlToUse
          };
        }).filter(button => button !== null);
        
        if (row.length > 0) {
          inlineKeyboard.inline_keyboard.push(row);
        }
      }
    }

    // КНОПКИ САЙТА И КАРТЫ
    if (place.website) {
      const normalizedWebsite = this.normalizeSocialUrl(place.website);
      if (normalizedWebsite && normalizedWebsite.trim() !== '') {
        const urlToUse = normalizedWebsite.startsWith('http') ? normalizedWebsite : `https://${normalizedWebsite}`;
        inlineKeyboard.inline_keyboard.push([
          { text: '🌐 Открыть сайт', url: urlToUse }
        ]);
      }
    }

    if (place.map_url) {
      const normalizedMapUrl = this.normalizeSocialUrl(place.map_url);
      if (normalizedMapUrl && normalizedMapUrl.trim() !== '') {
        const urlToUse = normalizedMapUrl.startsWith('http') ? normalizedMapUrl : `https://${normalizedMapUrl}`;
        inlineKeyboard.inline_keyboard.push([
          { text: '📍 Показать на карте', url: urlToUse }
        ]);
      }
    }

    // КНОПКИ ТАКСИ
    if (place.latitude && place.longitude) {
      const uberLink = this.getUberLinkForPlace(place);
      
      if (uberLink) {
        inlineKeyboard.inline_keyboard.push([
          {
            text: '🚗 Вызвать Uber',
            url: uberLink
          }
        ]);
      }
    }

    // КНОПКА "СКОПИРОВАТЬ НОМЕР"
    if (place.phone) {
      inlineKeyboard.inline_keyboard.push([
        {
          text: '📋 Скопировать телефон',
          callback_data: `copy_phone:${cityKey}:${placeId}`
        }
      ]);
    }

    // КНОПКА "РЕДАКТИРОВАТЬ СОЦСЕТИ" (ТОЛЬКО ДЛЯ АДМИНОВ)
    const isAdmin = this.isUserAdmin(userId);
    if (isAdmin) {
      inlineKeyboard.inline_keyboard.push([
      { 
        text: '✏️ Редактировать место', 
        callback_data: `edit_place_select:${cityKey}:${placeId}` 
      }
      ]);
    }

    // КНОПКА "ЧТО-ТО НЕ ТАК?"
    inlineKeyboard.inline_keyboard.push([
      { 
        text: '⚠️ Что-то не так?', 
        callback_data: `report_issue:${cityKey}:${placeId}` 
      }
    ]);

    // КНОПКИ НАВИГАЦИИ
    const navigationRow = [];

    if (place.category_id) {
      navigationRow.push({ 
        text: '🔙 К категории', 
        callback_data: `select_category:${cityKey}:${place.category_id}` 
      });
    }

    navigationRow.push({ 
      text: '🔙 К городу', 
      callback_data: `select_city:${cityKey}` 
    });

    navigationRow.push({ 
      text: '🏠 Главное меню', 
      callback_data: 'back:main_menu' 
    });

    inlineKeyboard.inline_keyboard.push(navigationRow);

    // ВАЛИДАЦИЯ И ОЧИСТКА КЛАВИАТУРЫ
    this.cleanInlineKeyboard(inlineKeyboard);
    
    if (!this.validateReplyMarkup(inlineKeyboard)) {
      console.error('❌ Некорректная клавиатура после очистки');
      const simpleKeyboard = {
        inline_keyboard: [
          [
            { text: '🔙 К категории', callback_data: `select_category:${cityKey}:${place.category_id}` },
            { text: '🔙 К городу', callback_data: `select_city:${cityKey}` }
          ],
          [
            { text: '⚠️ Что-то не так?', callback_data: `report_issue:${cityKey}:${placeId}` }
          ]
        ]
      };
      
      const simpleMessage = `🏛️ ${place.name}\n` +
                           `📁 ${category.emoji} ${category.name}\n\n` +
                           `📍 Адрес: ${place.address || 'не указан'}\n` +
                           `⏰ Время работы: ${place.working_hours || 'не указано'}\n` +
                           (place.average_price ? `💰 Средний чек: ${place.average_price}\n` : '') +
                           `\n📝 Описание:\n${place.description || 'Нет описания'}`;
      
      await this.sendAndTrack(chatId, simpleMessage, {
        reply_markup: simpleKeyboard,
        disable_web_page_preview: false
      });
      return;
    }

    // ✅ ОТПРАВЛЯЕМ С HTML И БЕЗ ПРЕДВАРИТЕЛЬНОГО ТЕСТА
    try {
      await this.sendAndTrack(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
        disable_web_page_preview: false
      });
      
    } catch (error) {
      console.error('❌ Ошибка при отправке с HTML:', error.message);
      
      // АВАРИЙНЫЙ ВАРИАНТ: отправляем как plain text
      const plainText = this.htmlToPlainText(message);
      try {
        await this.sendAndTrack(chatId, plainText, {
          reply_markup: inlineKeyboard,
          disable_web_page_preview: false
        });
      } catch (finalError) {
        console.error('❌ Критическая ошибка:', finalError.message);
        await this.sendAndTrack(chatId, `🏛️ ${place.name}\n📍 ${place.address || 'Адрес не указан'}`);
      }
    }

    // Показываем рекламу после места
    await this.showAdAfterPlace(chatId, userId, cityKey, placeId);

  } catch (error) {
    console.error('❌ Ошибка при показе деталей места:', error.message);
    console.error('❌ Stack trace:', error.stack);
    await this.sendAndTrack(chatId, '⚠️ Произошла ошибка при загрузке информации о месте.');
  }
}
// 🔥 ДОБАВИТЕ ЭТИ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
escapeHtmlAttribute(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
// Метод для тестирования HTML сообщения
async testHtmlMessage(chatId, html) {
  try {
    // Отправляем тестовое сообщение самому себе
    const testChatId = chatId; // Можно использовать специальный тестовый ID
    const testMessage = html.substring(0, 100); // Тестируем только первые 100 символов
    
    await this.bot.sendMessage(testChatId, testMessage, {
      parse_mode: 'HTML'
    });
    
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error.message,
      position: error.response?.body?.description?.match(/offset (\d+)/)?.[1]
    };
  }
}

// Метод для конвертации HTML в plain text
htmlToPlainText(html) {
  return html
    .replace(/<[^>]*>/g, '') // Убираем HTML теги
    .replace(/&lt;/g, '<')   // Восстанавливаем <
    .replace(/&gt;/g, '>')   // Восстанавливаем >
    .replace(/&amp;/g, '&')  // Восстанавливаем &
    .replace(/&quot;/g, '"') // Восстанавливаем "
    .replace(/&#39;/g, "'")  // Восстанавливаем '
    .replace(/&#96;/g, '`')  // Восстанавливаем `
    .replace(/\n{3,}/g, '\n\n'); // Убираем множественные переносы
}

// Улучшенный метод escapeHtml с дополнительной защитой
escapeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Сначала заменяем все опасные символы
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
  
  // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Удаляем непечатаемые символы
  const cleaned = escaped.replace(/[\u0000-\u001F\u007F-\u009F\u2000-\u200F\u2028-\u202F\u205F-\u206F\uFEFF]/g, '');
  
  return cleaned;
}
  async handleCopyPhone(chatId, cityKey, placeId) {
    try {
      const cityName = await this.getCityNameFromKey(cityKey);
      const place = await placeManager.getPlaceById(cityName, placeId);

      if (!place) {
        await this.sendAdminMessage(chatId, '❌ Место не найдено.');
        return;
      }

      if (!place.phone) {
        await this.sendAdminMessage(chatId, '❌ У этого места нет номера телефона.');
        return;
      }

      const phoneType = this.getPhoneType(place.phone);
      const formattedPhone = this.formatPhoneForCall(place.phone);

      // Создаем сообщение с форматированием для копирования
      let message = `📋 *Номер телефона для "${place.name}":*\n\n`;

      if (phoneType) {
        message += `*${phoneType}*\n`;
      }

      message += `\`${place.phone}\`\n\n`;
      message += `*Инструкция:*\n`;
      message += `1. Нажмите на номер выше, чтобы выделить его\n`;
      message += `2. Нажмите "Копировать" в меню\n`;
      message += `3. Вставьте в приложение телефона\n\n`;

      // Добавляем информацию о формате
      if (!place.phone.includes('+') && !place.phone.startsWith('00')) {
        message += `⚠️ *Примечание:* Номер указан без кода страны.\n`;
        message += `Для международных звонков добавьте код своей страны.\n\n`;
      }

      const inlineKeyboard = {
        inline_keyboard: []
      };

      if (formattedPhone) {
        inlineKeyboard.inline_keyboard.push([
          { 
            text: '📱 Позвонить сейчас', 
            url: `tel:${formattedPhone}` 
          }
        ]);
      }

      // Добавляем WhatsApp, если вероятно мобильный номер
      if (formattedPhone && this.isLikelyMobile(place.phone)) {
        const whatsappNumber = formattedPhone.replace(/[^\d+]/g, '');
        if (whatsappNumber.startsWith('+')) {
          inlineKeyboard.inline_keyboard.push([
            { 
              text: '💬 Открыть в WhatsApp', 
              url: `https://wa.me/${whatsappNumber.replace('+', '')}` 
            }
          ]);
        }
      }

      inlineKeyboard.inline_keyboard.push([
        { 
          text: '🔙 Назад к месту', 
          callback_data: `show_place:${cityKey}:${placeId}` 
        }
      ]);

      await this.sendAdminMessage(
        chatId,
        message,
        { 
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard
        }
      );

    } catch (error) {
      console.error('❌ Ошибка при копировании номера телефона:', error);
      await this.sendAdminMessage(
        chatId,
        '❌ Произошла ошибка при получении номера телефона.'
      );
    }
  }
  // ============ ДОБАВЛЕННЫЙ МЕТОД ============
  async showAdminPanel(chatId) {
    const cities = await cityManager.getAllCities();
    const totalPlaces = await this.getTotalPlacesCount();
    const categories = await categoryManager.getAllCategories();
    const ads = await this.adsManager.getAllAds();
    
    let message = '👑 *Панель администратора*\n\n';
    message += `📊 *Статистика:*\n`;
    message += `├ Городов: ${cities.length}\n`;
    message += `├ Всего мест: ${totalPlaces}\n`;
    message += `├ Категорий: ${categories.length}\n`;
    message += `└ Рекламных объявлений: ${ads.length}\n\n`;
    message += `*Доступные действия:*`;
    
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '➕ Добавить город', callback_data: 'admin_action:add_city' },
          { text: '🗑️ Удалить город', callback_data: 'admin_action:remove_city' }
        ],
        [
          { text: '📋 Список городов', callback_data: 'admin_action:list_cities' }
        ],
        [
          { text: '➕ Добавить место', callback_data: 'admin_action:add_place' },
          { text: '✏️ Редактировать место', callback_data: 'admin_action:edit_place' }
        ],
        [
          { text: '📁 Управление категориями', callback_data: 'admin_action:manage_categories' }
        ],
        [
          // ✅ НОВАЯ КНОПКА
          { text: '📢 Управление рекламой', callback_data: 'admin_action:manage_ads' }
        ],
        [
          { text: '📊 Статистика', callback_data: 'admin_action:stats' },
          { text: '🔄 Обновить данные', callback_data: 'admin_action:refresh' }
        ]
      ]
    };
    
    await this.sendAdminMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
  }

  async handleAdminAction(chatId, action, param, messageId) {
    switch(action) {
      case 'add_city':
        await this.startAddCity(chatId);
        break;
        
      case 'remove_city':
        await this.startRemoveCity(chatId);
        break;
        
      case 'list_cities':
        await this.showAdminCityList(chatId);
        break;
        
      case 'add_place':
        if (param) {
          const cityName = await this.getCityNameFromKey(param);
          await this.startAddPlace(chatId, cityName);
        } else {
          await this.startAddPlace(chatId);
        }
        break;
        
      case 'edit_place':
        if (param) {
          const cityName = await this.getCityNameFromKey(param);
          await this.startEditPlace(chatId, cityName);
        } else {
          await this.startEditPlace(chatId);
        }
        break;
        
    case 'edit_places':
      if (param) {
        await this.showPlacesForEdit(chatId, await this.getCityNameFromKey(param));
      } else {
        await this.startEditPlace(chatId);
      }
      break;

      case 'manage_categories':
        await this.showCategoryManagement(chatId);
        break;
        
      // ✅ НОВЫЙ CASE
      case 'manage_ads':
        await this.showAdsManagement(chatId);
        break;
      
      // ✅ НОВЫЙ CASE для синхронизации Firebase
      case 'sync_firebase':
        await this.syncDataToFirebase(chatId);
        break;
        
      case 'stats':
        await this.showAdminStats(chatId);
        break;
        
      case 'refresh':
        await this.sendAdminMessage(chatId, '✅ Данные обновлены!');
        break;
        
      case 'cancel':
        this.userStates.delete(chatId);
        await this.showAdminPanel(chatId);
        break;
        
      case 'back_to_panel':
        await this.showAdminPanel(chatId);
        break;
        
      case 'view_places':
        await this.showAllPlaces(chatId);
        break;
        
      case 'finish':
        this.adminSessions.delete(chatId);
        await this.showMainMenu(chatId, 'Главное меню:', true);
        break;
    }
  }

  async startAddCity(chatId) {
    await this.sendAdminMessage(
      chatId,
      '🏙️ *Добавление нового города*\n\n' +
      'Введите название города:',
      { parse_mode: 'Markdown' }
    );
    
    this.userStates.set(chatId, {
      action: 'adding_city',
      step: 'enter_name'
    });
  }

 async startRemoveCity(chatId) {
  const cities = await cityManager.getAllCities();

  if (cities.length === 0) {
    await this.sendAdminMessage(chatId, '📭 Нет городов для удаления.');
    return;
  }

  // ✅ СОРТИРУЕМ ГОРОДА ПО АЛФАВИТУ
  const sortedCities = [...cities].sort((a, b) => a.localeCompare(b, 'ru'));

  const inlineKeyboard = {
    inline_keyboard: []
  };

  for (let i = 0; i < sortedCities.length; i += 2) {
    const row = sortedCities.slice(i, i + 2).map(city => {
      const cityKey = this.getCityKey(city);
      console.log(`🔑 Создаю callback_data для города "${city}": admin_city:remove:${cityKey}`);

      return {
        text: city,
        callback_data: `admin_city:remove:${cityKey}`
      };
    });
    inlineKeyboard.inline_keyboard.push(row);
  }

  inlineKeyboard.inline_keyboard.push([
    { text: '🔙 Отмена', callback_data: 'admin_action:cancel' },
    { text: '🏠 Главное меню', callback_data: 'back:main_menu' }
  ]);

  await this.sendAdminMessage(
    chatId,
    '🗑️ *Удаление города*\n\n' +
    'Выберите город для удаления:',
    {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    }
  );
}


  async startAddPlace(chatId, cityName = null) {
  console.log(`🔍 [DEBUG startAddPlace] Called with cityName:`, { cityName });

  if (cityName && cityName.trim() !== '') {
    // Город уже выбран – переходим к выбору категории
    console.log(`✅ [DEBUG startAddPlace] Setting state with city: ${cityName}`);
    this.userStates.set(chatId, {
      action: 'adding_place',
      step: 'select_category',
      city: cityName,
      placeData: {}
    });

    await this.showCategorySelection(chatId, cityName);
  } else {
    // Город не указан – показываем список городов для выбора
    console.log(`⚠️ [DEBUG startAddPlace] No cityName, asking for city selection`);
    await this.askForCityForPlace(chatId);
  }
}

async askForCityForPlace(chatId) {
  const cities = await cityManager.getAllCities();

  if (cities.length === 0) {
    await this.sendAdminMessage(
      chatId,
      '📭 Сначала добавьте город через панель администратора.'
    );
    return;
  }

  // Очищаем любое существующее состояние
  this.userStates.delete(chatId);

  console.log('🏙️ Города для добавления места:', cities);

  // ✅ СОРТИРУЕМ ГОРОДА ПО АЛФАВИТУ
  const sortedCities = [...cities].sort((a, b) => a.localeCompare(b, 'ru'));

  const inlineKeyboard = { inline_keyboard: [] };

  // Строим кнопки по 2 в ряд
  for (let i = 0; i < sortedCities.length; i += 2) {
    const row = sortedCities.slice(i, i + 2).map(city => {
      const cityKey = this.getCityKey(city);
      return {
        text: `🏙️ ${city}`,
        callback_data: `admin_city:select_for_place:${cityKey}`
      };
    });
    inlineKeyboard.inline_keyboard.push(row);
  }

  // Кнопки навигации
  inlineKeyboard.inline_keyboard.push([
    { text: '❌ Отмена', callback_data: 'admin_action:cancel' },
    { text: '🏠 Главное меню', callback_data: 'back:main_menu' }
  ]);

  await this.sendAdminMessage(
    chatId,
    '🏙️ *Выберите город для добавления места:*',
    {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    }
  );
}

async showCategorySelection(chatId, cityName, isNewCategory = false) {
  // ВАЖНО: проверка, что город передан
  if (!cityName || cityName.trim() === '') {
    console.error('❌ Ошибка: cityName не определен!', { cityName });
    await this.sendAdminMessage(chatId, '❌ Ошибка: город не определен. Пожалуйста, выберите город еще раз.');
    await this.showAdminPanel(chatId);
    return;
  }

  const categories = await categoryManager.getAllCategories();
  const stats = await placeManager.getCityStats(cityName);

  // Если пользователь хочет создать новую категорию
  if (isNewCategory) {
    this.userStates.set(chatId, {
      action: 'adding_category',
      step: 'enter_name',
      city: cityName
    });

    await this.sendAdminMessage(
      chatId,
      '📁 *Создание новой категории*\n\n' +
      'Пожалуйста, введите название новой категории:',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Формируем сообщение
  let message = '📁 *Выберите категорию для нового места:*\n\n';

  // Добавляем статистику по категориям (количество мест в городе)
  const categoriesWithCounts = categories.map(cat => ({
    ...cat,
    count: stats.categoriesCount && stats.categoriesCount[cat.id] 
      ? stats.categoriesCount[cat.id].count 
      : 0
  }));

  // Разделяем на категории с местами и без
  const categoriesWithPlaces = categoriesWithCounts.filter(cat => cat.count > 0);
  const categoriesWithoutPlaces = categoriesWithCounts.filter(cat => cat.count === 0);

  // Сортируем по алфавиту
  categoriesWithPlaces.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  categoriesWithoutPlaces.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const inlineKeyboard = { inline_keyboard: [] };

  // Категории, в которых уже есть места (обычно показываем первыми)
  if (categoriesWithPlaces.length > 0) {
    inlineKeyboard.inline_keyboard.push([
      { 
        text: '📊 Категории с местами:', 
        callback_data: 'category_header:with_places' 
      }
    ]);

    for (let i = 0; i < categoriesWithPlaces.length; i += 2) {
      const row = categoriesWithPlaces.slice(i, i + 2).map(cat => ({
        text: `${cat.emoji} ${this.cleanButtonText(cat.name)} (${cat.count})`,
        callback_data: `admin_category:select:${cat.id}`
      }));
      inlineKeyboard.inline_keyboard.push(row);
    }
  }

  // Все остальные категории
  if (categoriesWithoutPlaces.length > 0) {
    inlineKeyboard.inline_keyboard.push([
      { 
        text: '📂 Все категории:', 
        callback_data: 'category_header:all' 
      }
    ]);

    for (let i = 0; i < categoriesWithoutPlaces.length; i += 2) {
      const row = categoriesWithoutPlaces.slice(i, i + 2).map(cat => ({
        text: `${cat.emoji} ${this.cleanButtonText(cat.name)}`,
        callback_data: `admin_category:select:${cat.id}`
      }));
      inlineKeyboard.inline_keyboard.push(row);
    }
  }

  // Кнопка создания новой категории
  inlineKeyboard.inline_keyboard.push([
    { 
      text: '➕ Создать новую категорию', 
      callback_data: 'admin_category:new' 
    }
  ]);

  // Кнопки навигации
  inlineKeyboard.inline_keyboard.push([
    { text: '🔙 Выбрать другой город', callback_data: 'admin_action:add_place' },
    { text: '❌ Отмена', callback_data: 'admin_action:cancel' },
    { text: '🏠 Главное меню', callback_data: 'back:main_menu' }
  ]);

  // Обязательно очищаем callback_data и валидируем клавиатуру
  this.cleanInlineKeyboard(inlineKeyboard);

  if (!this.validateReplyMarkup(inlineKeyboard)) {
    console.warn('⚠️ Некорректная клавиатура, отправляю без неё');
    await this.sendAdminMessage(chatId, message, { parse_mode: 'Markdown' });
    return;
  }

  await this.sendAdminMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}

async handleCategoryCallback(chatId, userId, action, params, messageId) {
  const state = this.userStates.get(chatId);

  console.log(`🔍 [DEBUG handleCategoryCallback] State:`, state);

  if (!state || state.action !== 'adding_place') {
    await this.sendAdminMessage(
      chatId,
      '❌ Сессия устарела. Начните заново.'
    );
    return;
  }

  const cityName = state.city;

  console.log(`🔍 [DEBUG handleCategoryCallback] cityName from state:`, { cityName });

  if (!cityName || cityName.trim() === '') {
    await this.sendAdminMessage(
      chatId,
      '❌ Не удалось определить город. Начните заново.'
    );
    await this.showAdminPanel(chatId);
    return;
  }

  switch (action) {
    case 'select':
      const categoryId = params[0];
      const category = await categoryManager.getCategoryById(categoryId);

      if (category) {
        state.placeData.category_id = categoryId;
        state.placeData.category_name = category.name;
        state.placeData.category_emoji = category.emoji;
        state.step = 'enter_name';
        this.userStates.set(chatId, state);

        await this.sendAdminMessage(
          chatId,
          `✅ Вы выбрали категорию: ${category.emoji} *${category.name}*\n\n` +
          `Теперь введите название места:`,
          { parse_mode: 'Markdown' }
        );
      }
      break;

    case 'new':
      // Передаём cityName и флаг isNewCategory = true
      await this.showCategorySelection(chatId, cityName, true);
      break;
  }
}

async startEditPlace(chatId, cityName = null) {
  // Если передан город — сразу переходим к списку мест для редактирования
  if (cityName) {
    await this.showPlacesForEdit(chatId, cityName);
    return;
  }

  // Иначе показываем выбор города
  const cities = await cityManager.getAllCities();
  if (cities.length === 0) {
    await this.sendAdminMessage(chatId, '📭 Нет городов для редактирования.');
    return;
  }

  // ✅ СОРТИРУЕМ ГОРОДА ПО АЛФАВИТУ
  const sortedCities = [...cities].sort((a, b) => a.localeCompare(b, 'ru'));

  const inlineKeyboard = { inline_keyboard: [] };

  // Строим кнопки по 2 в ряд
  for (let i = 0; i < sortedCities.length; i += 2) {
    const row = sortedCities.slice(i, i + 2).map(city => {
      const cityKey = this.getCityKey(city);
      return {
        text: `🏙️ ${city}`,
        callback_data: `admin_city:select_for_edit:${cityKey}`
      };
    });
    inlineKeyboard.inline_keyboard.push(row);
  }

  // Кнопки навигации
  inlineKeyboard.inline_keyboard.push([
    { text: '❌ Отмена', callback_data: 'admin_action:cancel' },
    { text: '🏠 Главное меню', callback_data: 'back:main_menu' }
  ]);

  await this.sendAdminMessage(
    chatId,
    '✏️ *Редактирование места*\n\n' +
    'Выберите город, в котором хотите отредактировать место:',
    {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    }
  );
}

async showAdminCityList(chatId) {
  const cities = await cityManager.getAllCities();

  if (cities.length === 0) {
    await this.sendAdminMessage(chatId, '📭 Список городов пуст.');
    return;
  }

  // ✅ СОРТИРУЕМ ГОРОДА ПО АЛФАВИТУ
  const sortedCities = [...cities].sort((a, b) => a.localeCompare(b, 'ru'));

  let message = '🏙️ *Список городов:*\n\n';
  sortedCities.forEach((city, index) => {
    message += `${index + 1}. ${city}\n`;
  });

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '🔙 Назад в админку', callback_data: 'admin_action:back_to_panel' }
      ]
    ]
  };

  await this.sendAdminMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}

    async handleAdminCityAction(chatId, action, cityKey, messageId) {
    // Получаем настоящее название города
    const cityName = await this.getCityNameFromKey(cityKey);
    
    switch(action) {
      case 'remove':
        const result = await cityManager.removeCity(cityName);
        await this.sendAdminMessage(chatId, result.message);
        break;
        
      case 'select_for_place':
        await this.startAddPlace(chatId, cityName);
        break;
        
      case 'select_for_edit':
        await this.showPlacesForEdit(chatId, cityName);
        break;
    }
  }

  // ============ ДОБАВЛЕННЫЕ МЕТОДЫ ДЛЯ ОБРАБОТКИ КОМАНД ============
  async handleMyIdCommand(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isAdmin = this.isUserAdmin(userId);
    
    await this.deleteLastMessage(chatId);
    
    await this.sendAndTrack(
      chatId,
      `📋 Ваши данные:\n\n` +
      `ID: ${userId}\n` +
      `Имя: ${msg.from.first_name}\n` +
      `Username: @${msg.from.username || 'нет'}\n` +
      `Статус: ${isAdmin ? '👑 АДМИН' : '👤 ПОЛЬЗОВАТЕЛЬ'}`
    );
  }

  async handleAdminCommand(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    await this.deleteLastMessage(chatId);
    
    if (this.isUserAdmin(userId)) {
      // Устанавливаем флаг админ-сессии
      this.adminSessions.set(chatId, true);
      await this.showAdminPanel(chatId);
    } else {
      await this.sendAdminMessage(chatId, '⛔ Команда доступна только администраторам.');
    }
  }

  async handleCitiesCommand(msg) {
    const chatId = msg.chat.id;
    
    await this.deleteLastMessage(chatId);
    
    const cities = await cityManager.getAllCities();
    
    if (cities.length === 0) {
      await this.sendAndTrack(chatId, '📭 Список городов пуст.');
      return;
    }
    
    let message = '🏙️ *Доступные города:*\n\n';
    cities.forEach((city, index) => {
      message += `${index + 1}. ${city}\n`;
    });
    
    await this.sendAndTrack(chatId, message, { parse_mode: 'Markdown' });
  }

  async handleHelpCommand(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isAdmin = this.isUserAdmin(userId);
    
    await this.deleteLastMessage(chatId);
    
    let message = '🆘 *Помощь по боту*\n\n';
    message += '*Основные команды:*\n';
    message += '/start - Главное меню\n';
    message += '/cities - Список городов\n';
    message += '/myid - Показать ваш ID\n';
    message += '/help - Эта справка\n\n';
    
    if (isAdmin) {
      message += '*Команды для админов:*\n';
      message += '/admin - Панель администратора\n';
      message += '/cleanup - Очистить данные от недопустимых символов\n';
    }
    
    await this.sendAndTrack(chatId, message, { parse_mode: 'Markdown' });
  }

async diagnoseCallbackIssue(chatId) {
  try {
    await this.sendAdminMessage(chatId, '🔍 *Диагностика callback_data*\n\nНачинаю проверку...');
    
    // Тестируем различные типы данных
    const testCases = [
      1, // число (именно эта ошибка!)
      '1', // строка с числом
      'select_city:moscow',
      'edit_category_select:123',
      'ecat:moscow:abc123:cat1',
      null,
      undefined,
      true,
      { test: 'object' },
      [1, 2, 3]
    ];
    
    let report = '🧪 *Результаты тестирования cleanCallbackData:*\n\n';
    
    testCases.forEach((testData, index) => {
      const result = this.cleanCallbackData(testData);
      report += `${index + 1}. Тип: ${typeof testData}, Значение: ${JSON.stringify(testData)}\n`;
      report += `   Результат: "${result}"\n\n`;
    });
    
    // Тестируем байтовую длину
    report += '*Проверка длины:*\n';
    const longTest = 'edit_category_select:очень_длинный_город_с_русскими_буквами:очень_длинный_id_категории_1234567890';
    const longResult = this.cleanCallbackData(longTest);
    const byteLength = Buffer.byteLength(longResult, 'utf8');
    report += `Длинная строка: ${byteLength} байт (${byteLength > 64 ? '❌ СЛИШКОМ ДЛИННЫЙ' : '✅ OK'})\n`;
    report += `Результат: "${longResult}"\n\n`;
    
    // Проверяем, какие категории загружены
    const categories = await categoryManager.getAllCategories();
    report += `📊 Загружено категорий: ${categories.length}\n`;
    
    // Проверяем ID категорий на проблемы
    const problemCategories = [];
    categories.forEach(cat => {
      const cleanedId = this.cleanCallbackData(cat.id);
      if (cleanedId !== cat.id) {
        problemCategories.push({
          name: cat.name,
          originalId: cat.id,
          cleanedId: cleanedId
        });
      }
    });
    
    if (problemCategories.length > 0) {
      report += `⚠️ Проблемные категории (ID изменены при очистке):\n`;
      problemCategories.forEach(cat => {
        report += `• ${cat.name}: ${cat.originalId} → ${cat.cleanedId}\n`;
      });
    } else {
      report += `✅ Все ID категорий корректны\n`;
    }
    
    await this.sendAdminMessage(chatId, report, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('❌ Ошибка диагностики:', error);
    await this.sendAdminMessage(chatId, `❌ Ошибка диагностики: ${error.message}`);
  }
}

  async handleCleanupCommand(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (this.isUserAdmin(userId)) {
      await this.deleteLastMessage(chatId);
      await this.cleanupPlaceData(chatId);
    } else {
      await this.sendAdminMessage(chatId, '⛔ Команда доступна только администраторам.');
    }
  }

  setupHandlers() {
    // Установка меню команд
    this.setBotCommands();

    setTimeout(async () => {
      try {
        const result = await categoryManager.checkAndRepairCategories();
        console.log(`✅ Проверка категорий: ${result.message}`);
      } catch (error) {
        console.error('❌ Ошибка при проверке категорий:', error);
      }
    }, 2000);
    
    // Обработчик для сообщений с фото
    this.bot.on('photo', async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      const userState = this.userStates.get(chatId);
      
      // Проверяем, находится ли пользователь в процессе добавления фото к месту
      if (userState && userState.action === 'adding_place' && userState.step === 'add_photos') {
        await this.handlePhotoMessage(chatId, msg);
      }
      
      // Проверяем, находится ли пользователь в процессе добавления фото к городу
      if (userState && userState.action === 'adding_city' && userState.step === 'add_photo') {
        await this.handleCityPhotoMessage(chatId, msg, userState);
      }
    });


// Добавьте эту команду в setupHandlers()
this.bot.onText(/\/diagnose/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!this.isUserAdmin(userId)) {
    await this.sendAdminMessage(chatId, '❌ Команда доступна только администраторам');
    return;
  }
  
  await this.deleteLastMessage(chatId);
  await this.diagnoseCallbackIssue(chatId);
});

// Также добавьте команду для тестирования чистки
this.bot.onText(/\/testclean/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!this.isUserAdmin(userId)) return;
  
  const testData = [
    'edit_category_select:1',
    'edit_category_select:москва:123',
    'admin_category:select:1',
    'admin_category:select:🍕_пицца'
  ];
  
  let message = '🧹 *Тест очистки callback_data:*\n\n';
  
  testData.forEach((data, index) => {
    const cleaned = this.cleanCallbackData(data);
    message += `${index + 1}. "${data}"\n   → "${cleaned}"\n\n`;
  });
  
  await this.sendAdminMessage(chatId, message, { parse_mode: 'Markdown' });
});
// И обработчик команды
this.bot.onText(/\/fixhours (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const placeId = match[1];
  
  if (!this.isUserAdmin(userId)) return;
  
  await this.fixPlaceWorkingHours(chatId, placeId);
});

// Добавьте этот обработчик в конструктор
this.bot.onText(/\/debugplace (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const placeId = match[1];
  
  if (!this.isUserAdmin(userId)) return;
  
  try {
    // Найти место по ID
    const cities = await cityManager.getAllCities();
    let foundPlace = null;
    let foundCity = null;
    
    for (const city of cities) {
      const place = await placeManager.getPlaceById(city, placeId);
      if (place) {
        foundPlace = place;
        foundCity = city;
        break;
      }
    }
    
    if (!foundPlace) {
      await this.bot.sendMessage(chatId, '❌ Место не найдено');
      return;
    }
    
    // Проверить описание на наличие проблемных символов
    const description = foundPlace.description || '';
    console.log('🔍 [DEBUG] Длина описания:', description.length);
    console.log('🔍 [DEBUG] Первые 200 символов:', description.substring(0, 200));
    
    // Проверить на непечатаемые символы
    const nonPrintable = description.match(/[\u0000-\u001F\u007F-\u009F\u2000-\u200F\u2028-\u202F\u205F-\u206F\uFEFF]/g);
    if (nonPrintable) {
      console.log('❌ Найдены непечатаемые символы:', nonPrintable.map(c => c.charCodeAt(0)));
    }
    
    // Показать информацию о месте
    await this.bot.sendMessage(
      chatId,
      `🔍 *Debug Info: ${foundPlace.name}*\n\n` +
      `ID: \`${foundPlace.id}\`\n` +
      `Город: ${foundCity}\n` +
      `Описание (длина): ${description.length} символов\n` +
      `Непечатаемые символы: ${nonPrintable ? 'ДА' : 'НЕТ'}\n\n` +
      `Тестирую HTML...`
    );
    
    // Протестировать отправку
    const cityKey = this.getCityKey(foundCity);
    await this.showPlaceDetails(chatId, cityKey, foundPlace.id, userId);
    
  } catch (error) {
    console.error('❌ Ошибка debug:', error);
    await this.bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
  }
});

// Команда принудительной синхронизации
this.bot.onText(/\/forcesync/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!this.isUserAdmin(userId)) {
    await this.sendAdminMessage(chatId, '❌ Команда доступна только администраторам');
    return;
  }
  
  await this.deleteLastMessage(chatId);
  await this.forceSyncToFirebase(chatId);
});

// Команда статуса Firebase
this.bot.onText(/\/firebasestatus/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!this.isUserAdmin(userId)) {
    await this.sendAdminMessage(chatId, '❌ Команда доступна только администраторам');
    return;
  }
  
  await this.deleteLastMessage(chatId);
  await this.showFirebaseStatus(chatId);
});

// Команда миграции данных
this.bot.onText(/\/migratetofirebase/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!this.isUserAdmin(userId)) {
    await this.sendAdminMessage(chatId, '❌ Команда доступна только администраторам');
    return;
  }
  
  await this.deleteLastMessage(chatId);
  await this.migrateAllDataToFirebase(chatId);
});

this.bot.onText(/\/testfirebasedb/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!this.isUserAdmin(userId)) return;
  
  try {
    await this.sendAdminMessage(chatId, '🧪 Тестирую подключение к Firebase Database...');
    
    // Прямой тест Firebase
    if (this.firebaseDB && this.firebaseDB.db) {
      const testRef = this.firebaseDB.db.ref('test');
      await testRef.set({
        test: 'test',
        timestamp: Date.now()
      });
      
      const snapshot = await testRef.once('value');
      const data = snapshot.val();
      
      await this.sendAdminMessage(
        chatId,
        `✅ Firebase Database работает!\n\n` +
        `Данные теста: ${JSON.stringify(data, null, 2)}`
      );
    } else {
      await this.sendAdminMessage(
        chatId,
        '❌ Firebase Database не инициализирована'
      );
    }
  } catch (error) {
    console.error('❌ Ошибка теста Firebase:', error);
    await this.sendAdminMessage(
      chatId,
      `❌ Ошибка Firebase: ${error.message}\n\n` +
      `Stack: ${error.stack}`
    );
  }
});

this.bot.onText(/\/testcities/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isAdmin = this.isUserAdmin(userId);
  
  console.log(`🧪 [testcities] Тестирую получение городов`);
  
  try {
    const cities = await cityManager.getAllCities();
    console.log(`🧪 [testcities] Города получены:`, cities);
    
    await this.bot.sendMessage(
      chatId,
      `🧪 Тест городов:\n\n` +
      `Всего городов: ${cities.length}\n` +
      `Города: ${cities.join(', ') || 'нет'}`
    );
    
  } catch (error) {
    console.error(`❌ [testcities] Ошибка:`, error);
    await this.bot.sendMessage(
      chatId,
      `❌ Ошибка при получении городов:\n${error.message}`
    );
  }
});

this.bot.onText(/\/checkfirebase/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!this.isUserAdmin(userId)) {
    await this.sendAdminMessage(chatId, '❌ Команда доступна только администраторам');
    return;
  }
  
  let status = '🔍 *Статус Firebase в менеджерах:*\n\n';
  
  // Проверяем подключение
  status += `📁 CategoryManager: ${categoryManager.firebaseDB?.initialized ? '✅ Подключен' : '❌ Не подключен'}\n`;
  status += `📢 AdsManager: ${adsManager.firebaseDB?.initialized ? '✅ Подключен' : '❌ Не подключен'}\n`;
  status += `🏙️ CityManager: ${cityManager.firebaseDB?.initialized ? '✅ Подключен' : '❌ Не подключен'}\n`;
  status += `📍 PlaceManager: ${placeManager.firebaseDB?.initialized ? '✅ Подключен' : '❌ Не подключен'}\n\n`;
  
  // Проверяем данные
  try {
    const categories = await categoryManager.getAllCategories();
    status += `\n📊 *Результат чтения:*\n`;
    status += `Категорий: ${categories.length}\n`;
    
    const cities = await cityManager.getAllCities();
    status += `Городов: ${cities.length}\n`;
    
    const ads = await adsManager.getAllAds();
    status += `Объявлений: ${ads.length}\n`;
    
  } catch (error) {
    status += `\n❌ Ошибка чтения: ${error.message}`;
  }
  
  await this.sendAdminMessage(chatId, status, { parse_mode: 'Markdown' });
});

this.bot.onText(/\/testuber/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!this.isUserAdmin(userId)) {
    await this.sendAdminMessage(chatId, '❌ У вас нет доступа к этой команде.');
    return;
  }
  
  await this.deleteLastMessage(chatId);
  
  const cities = await cityManager.getAllCities();
  if (cities.length === 0) {
    await this.sendAdminMessage(chatId, '📭 Нет городов для теста.');
    return;
  }
  
  const cityName = cities[0];
  const places = await placeManager.getPlacesByCity(cityName);
  
  const testPlace = places.find(p => p.latitude && p.longitude);
  
  if (!testPlace) {
    await this.sendAdminMessage(chatId, '❌ Нет мест с координатами для теста Uber.');
    return;
  }
  
  await this.testUberDeeplink(chatId, testPlace);
});



    
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const userName = msg.from.first_name;
      const isAdmin = this.isUserAdmin(userId);
      
      // Сбрасываем админ-сессию при старте
      this.adminSessions.delete(chatId);
      
      await this.deleteLastMessage(chatId);
      
      const welcomeText = `👋 Привет, ${userName}!\n\n` +
                         `Я - ваш персональный гид по городам. Я помогу найти интересные места, ` +
                         `расскажу о событиях и подскажу куда сходить.\n\n`;
      
      await this.showMainMenu(chatId, welcomeText, isAdmin);
    });

    this.bot.onText(/\/cities/, async (msg) => {
      const chatId = msg.chat.id;
      
      await this.deleteLastMessage(chatId);
      await this.showCitySelection(chatId);
    });

    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      
      await this.deleteLastMessage(chatId);
      
      const helpText = `❓ *Справка по боту*\n\n` +
                       `Доступные команды:\n` +
                       `/start - Главное меню\n` +
                       `/cities - Выбрать город\n` +
                       `/help - Справка\n\n` +
                       `Как пользоваться ботом:\n` +
                       `1️⃣ Нажмите /start для входа\n` +
                       `2️⃣ Выберите интересующий вас город\n` +
                       `3️⃣ Просмотрите места в категориях\n` +
                       `4️⃣ Получите информацию о каждом месте\n\n` +
                       `Вопросы? Обратитесь в поддержку!`;
      
      await this.bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
    });

    this.bot.onText(/\/updateallcoords/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      if (this.isUserAdmin(userId)) {
        try {
          await this.sendAdminMessage(
            chatId,
            '🔄 *Начинаю массовое обновление координат*\n\n' +
            'Ищу места с ссылками на карты, но без координат...\n' +
            'Это может занять несколько минут.',
            { parse_mode: 'Markdown' }
          );
          
          const cities = await cityManager.getAllCities();
          let totalUpdated = 0;
          let totalFailed = 0;
          let report = '';
          
          for (const city of cities) {
            const places = await placeManager.getPlacesByCity(city);
            let cityUpdated = 0;
            
            report += `\n🏙️ *${city}:*\n`;
            
            for (const place of places) {
              // Если у места есть map_url, но нет координат
              if (place.map_url && (!place.latitude || !place.longitude)) {
                console.log(`🔍 Обрабатываю "${place.name}" в ${city}`);
                
                const extracted = await this.extractDataFromMapUrl(place.map_url);
                
                if (extracted.success && extracted.latitude && extracted.longitude) {
                  const updateData = {
                    latitude: extracted.latitude,
                    longitude: extracted.longitude
                  };
                  
                  if (extracted.google_place_id) {
                    updateData.google_place_id = extracted.google_place_id;
                  }
                  
                  await placeManager.updatePlace(city, place.id, updateData);
                  cityUpdated++;
                  totalUpdated++;
                  
                  report += `  ✅ ${place.name}: извлечены координаты\n`;
                } else {
                  totalFailed++;
                  report += `  ❌ ${place.name}: не удалось извлечь\n`;
                }
                
                // Небольшая задержка между запросами
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
            
            if (cityUpdated === 0) {
              report += `  📭 Нет мест для обновления\n`;
            }
          }
          
          const finalMessage = `🔄 *Массовое обновление завершено!*\n\n` +
            `📊 *Результаты:*\n` +
            `• Городов обработано: ${cities.length}\n` +
            `• Мест обновлено: ${totalUpdated}\n` +
            `• Не удалось обновить: ${totalFailed}\n\n` +
            `*Детальный отчет:*\n${report}`;
          
          // Отправляем отчет (может быть длинным)
          if (finalMessage.length < 4000) {
            await this.sendAdminMessage(chatId, finalMessage, { parse_mode: 'Markdown' });
          } else {
            // Если сообщение слишком длинное, отправляем частями
            const parts = finalMessage.match(/[\s\S]{1,4000}/g) || [];
            for (let i = 0; i < parts.length; i++) {
              await this.sendAdminMessage(chatId, parts[i], { 
                parse_mode: 'Markdown',
                disable_web_page_preview: true 
              });
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
        } catch (error) {
          console.error('❌ Ошибка массового обновления:', error);
          await this.sendAdminMessage(chatId, `❌ Ошибка: ${error.message}`);
        }
      }
    });

    this.bot.onText(/\/testphoto/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      if (this.isUserAdmin(userId)) {
        await this.deleteLastMessage(chatId);
        
        await this.sendAdminMessage(
          chatId,
          '📸 Тестовая команда для проверки загрузки фото.\n' +
          'Отправьте фото для тестирования.'
        );
        
        this.userStates.set(chatId, {
          action: 'testing_photo',
          step: 'waiting_photo'
        });
      }
    });

this.bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    const isAdmin = this.isUserAdmin(userId);
    
    // Пропускаем сообщения с фото - они обрабатываются отдельным обработчиком
    if (msg.photo) return;
    
    if (!text) return;
    
    // ✅ КРИТИЧЕСКИ ВАЖНО: Проверяем ГЛАВНОЕ МЕНЮ ПЕРВЫМ!
    if (text && this.isMainMenuCommand(text)) {
        console.log(`🎯 Обработка команды главного меню: "${text}"`);
        await this.handleMainMenuCommand(chatId, text, isAdmin);
        return;  // ВАЖНО: завершаем обработку
    }
    
    // Если текст начинается с '/' - это команда, которая обрабатывается в onText
    if (text.startsWith('/')) return;
    
    const userState = this.userStates.get(chatId);
    
    // ✅ ПРОВЕРЯЕМ СОСТОЯНИЯ РЕДАКТИРОВАНИЯ (ВЫСОКИЙ ПРИОРИТЕТ)
    if (userState && userState.action === 'editing_field' && userState.step === 'enter_new_value') {
        // Если пользователь отменяет редактирование
        if (text === '❌ Отменить редактирование') {
            this.userStates.delete(chatId);
            await this.bot.sendMessage(chatId, '❌ Редактирование отменено.', {
                reply_markup: { remove_keyboard: true }
            });
            
            if (userState.cityKey && userState.placeId) {
                await this.showPlaceEditOptions(chatId, userState.cityKey, userState.placeId);
            }
            return;
        }
        
        // Обработка ввода нового значения
        await this.processFieldEdit(chatId, text, userState);
        return;
    }
    
    // ✅ ТЕПЕРЬ ОБРАБАТЫВАЕМ ДРУГИЕ СОСТОЯНИЯ
    if (userState) {
        // Проверяем, не пытается ли пользователь просматривать город
        if (userState.action === 'browsing_city') {
            // Разрешаем обработку названий городов и категорий
            const cities = await cityManager.getAllCities();
            if (cities.includes(text)) {
                await this.handleCitySelection(chatId, this.getCityKey(text), isAdmin);
                return;
            }
            
            const categories = await categoryManager.getAllCategories();
            const category = categories.find(c => c.name === text);
            if (category && userState.selectedCity) {
                await this.showPlacesByCategory(chatId, this.getCityKey(userState.selectedCity), category.id);
                return;
            }
        }
        
        // Проверяем, не выбирает ли пользователь место
        if (userState.action === 'selecting_place') {
            const place = userState.places.find(p => p.name.substring(0, 30) === text || p.name === text);
            if (place) {
                await this.showPlaceDetails(chatId, userState.cityKey, place.id, userId);
                return;
            }
        }
        
        // Для всех остальных состояний вызываем handleUserState
        await this.handleUserState(chatId, userId, msg, userState, isAdmin);
        return;
    }
    
    // ✅ ЕСЛИ НЕТ СОСТОЯНИЯ - ПРОВЕРЯЕМ, НЕ ГОРОД/КАТЕГОРИЯ ЛИ ЭТО
    // Проверяем, это ли название города
    const cities = await cityManager.getAllCities();
    if (cities.includes(text)) {
        await this.handleCitySelection(chatId, this.getCityKey(text), isAdmin);
        return;
    }
    
    // Проверяем, это ли название категории
    const categories = await categoryManager.getAllCategories();
    const category = categories.find(c => c.name === text);
    if (category && userState && userState.selectedCity) {
        await this.showPlacesByCategory(chatId, this.getCityKey(userState.selectedCity), category.id);
        return;
    }
    
    // ✅ ЕСЛИ НИЧЕГО НЕ ПОДОШЛО - ПОКАЗЫВАЕМ ПОДСКАЗКУ
    await this.bot.sendMessage(
        chatId,
        '🤔 Не понимаю эту команду.\n\n' +
        'Используйте меню внизу или команду /start',
        {
            reply_markup: this.getKeyboardWithMainMenu(isAdmin)
        }
    );
});
    // ============ ОБРАБОТЧИК CALLBACK_QUERY ============
 this.bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  const isAdmin = this.isUserAdmin(userId);
  const messageId = callbackQuery.message.message_id;
  
  console.log(`📱 Callback от ${userId}: ${data}`);
  console.log(`🔍 [DEBUG] Полный callback_data: "${data}"`, typeof data);
  
  try {
    // ✅ ИСПРАВЛЕНИЕ: Сначала преобразуем data в строку, если это необходимо
    let callbackData = data;
    if (typeof callbackData !== 'string') {
      if (typeof callbackData === 'number') {
        callbackData = callbackData.toString();
        console.log(`🔍 [DEBUG] Преобразовано число в строку: ${callbackData}`);
      } else if (callbackData === null || callbackData === undefined) {
        console.error('❌ callback_data равно null или undefined');
        await this.bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Ошибка: пустой callback' });
        return;
      } else {
        callbackData = String(callbackData);
        console.log(`🔍 [DEBUG] Преобразовано ${typeof data} в строку: ${callbackData}`);
      }
    }
    
    // СРАЗУ отвечаем на callback_query
    await this.bot.answerCallbackQuery(callbackQuery.id);
    
    if (!callbackData || callbackData.trim() === '') {
      console.error('❌ Пустой или некорректный callback_data');
      return;
    }
    
    const parts = callbackData.split(':');
    console.log(`🔍 [DEBUG] Разбитые части:`, parts);
    
    // ✅ ИСПРАВЛЕНИЕ: Очищаем и преобразуем каждую часть
const cleanedParams = parts.slice(1).map(param => {
  // Преобразуем параметры в строку и очищаем
  let paramStr;
  if (typeof param === 'number') {
    paramStr = param.toString();
  } else if (typeof param === 'string') {
    paramStr = param;
  } else if (param === undefined || param === null) {
    paramStr = '';
  } else {
    paramStr = String(param);
  }
  return this.cleanCallbackData(paramStr);
});

// ✅ ИСПРАВЛЕНИЕ: Убедимся, что action тоже строка
const action = this.cleanCallbackData(parts[0] || '');
    
    console.log(`🔍 [DEBUG] Action: ${action}, Params:`, cleanedParams);
    
    // Ограничиваем максимальное время обработки 8 секундами
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Таймаут обработки callback')), 8000);
    });
    
    // Запускаем обработку с таймаутом
    await Promise.race([
      this.processCallbackActionInternal(chatId, userId, action, cleanedParams, messageId, isAdmin),
      timeoutPromise
    ]);
    
  } catch (error) {
    console.error(`❌ Ошибка обработки callback для ${userId}:`, error.message);
    console.error('❌ Stack trace:', error.stack);
    
    if (error.message !== 'Таймаут обработки callback') {
      try {
        await this.bot.sendMessage(
          chatId,
          '⚠️ Произошла ошибка при обработке запроса. Пожалуйста, попробуйте еще раз.'
        );
      } catch (sendError) {
        console.error(`❌ Не удалось отправить сообщение об ошибке: ${sendError.message}`);
      }
    }
  }
});

    // Обработчики команд с использованием добавленных методов
    this.bot.onText(/\/myid/, (msg) => this.handleMyIdCommand(msg));
    this.bot.onText(/\/admin/, (msg) => this.handleAdminCommand(msg));
    this.bot.onText(/\/cities/, (msg) => this.handleCitiesCommand(msg));
    this.bot.onText(/\/help/, (msg) => this.handleHelpCommand(msg));
    this.bot.onText(/\/cleanup/, (msg) => this.handleCleanupCommand(msg));
    
this.bot.onText(/\/testmain/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isAdmin = this.isUserAdmin(userId);
  
  console.log(`🧪 Тест главного меню для ${userId}`);
  
  // Показываем главное меню разными способами
  await this.showMainMenu(chatId, 'Тест главного меню:', isAdmin);
  
  // Проверяем через 2 секунды
  setTimeout(async () => {
    await this.bot.sendMessage(
      chatId,
      'Если вы не видите главное меню выше, есть проблема с отправкой сообщений.'
    );
  }, 2000);
});

    this.bot.onText(/\/testfirebase/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      if (this.isUserAdmin(userId)) {
        if (!this.firebaseStorage) {
          await this.sendAdminMessage(
            chatId,
            '❌ Firebase Storage не был инициализирован при запуске бота.\n' +
            'Проверьте:\n' +
            '1. Файл serviceAccountKey.json в корне проекта\n' +
            '2. Содержимое JSON файла\n' +
            '3. Наличие пакета firebase-admin'
          );
          return;
        }
        
        if (!this.firebaseStorage.initialized) {
          await this.sendAdminMessage(
            chatId,
            '❌ Firebase Storage не инициализирован.\n' +
            'Возможные причины:\n' +
            '1. Файл serviceAccountKey.json не найден\n' +
            '2. Неверный формат JSON файла\n' +
            '3. Ошибка аутентификации в Firebase'
          );
          return;
        }
        
        try {
          const testResult = await this.firebaseStorage.testConnection();
          
          if (testResult.success) {
            await this.sendAdminMessage(
              chatId,
              `✅ Firebase Storage подключен успешно!\n\n` +
              `📦 Bucket: ${testResult.bucketName}\n` +
              `📊 Файлов в хранилище: ${testResult.fileCount || 0}\n` +
              `🔄 Статус: Инициализирован`
            );
          } else {
            await this.sendAdminMessage(
              chatId,
              `❌ Ошибка подключения к Firebase:\n${testResult.error}\n\n` +
              `🔄 Статус: ${this.firebaseStorage.initialized ? 'Инициализирован' : 'Не инициализирован'}`
            );
          }
        } catch (error) {
          await this.sendAdminMessage(
            chatId,
            `❌ Неожиданная ошибка при тестировании Firebase:\n${error.message}`
          );
        }
      }
    });
    
    this.bot.onText(/\/checkplace (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      if (!this.isUserAdmin(userId)) return;
      
      const placeId = match[1];
      const cities = await cityManager.getAllCities();
      
      for (const city of cities) {
        const place = await placeManager.getPlaceById(city, placeId);
        if (place) {
          await this.sendAdminMessage(
            chatId,
            `🔍 *Данные места:*\n\n` +
            `Название: ${place.name}\n` +
            `Широта: ${place.latitude || 'НЕТ'}\n` +
            `Долгота: ${place.longitude || 'НЕТ'}\n` +
            `Google Place ID: ${place.google_place_id || 'НЕТ'}\n` +
            `Map URL: ${place.map_url || 'НЕТ'}`,
            { parse_mode: 'Markdown' }
          );
          return;
        }
      }
      
      await this.sendAdminMessage(chatId, '❌ Место не найдено');
    });
  }

  // ============ УСТАНОВКА КОМАНД МЕНЮ ============
  async setBotCommands() {
    try {
      const commands = [
        {
          command: 'start',
          description: '🏠 Главное меню'
        }
      ];

      // Установка команд для обычных пользователей
      await this.bot.setMyCommands(commands);
      console.log('✅ Меню команд установлено');
    } catch (error) {
      console.error('❌ Ошибка при установке меню команд:', error);
    }
  }


// Метод для обработки выбора категории с короткими ID
async handleEditCategorySelectShort(chatId, cityKey, shortPlaceId, shortCategoryId) {
  try {
    console.log(`🔍 [handleEditCategorySelectShort] Параметры:`, {
      cityKey,
      shortPlaceId,
      shortCategoryId
    });
    
    // ✅ ДОБАВЛЕНА ПРОВЕРКА НА ПУСТЫЕ ПАРАМЕТРЫ
    if (!cityKey || !shortPlaceId || !shortCategoryId) {
      console.error('❌ Недостаточно параметров для handleEditCategorySelectShort');
      await this.sendAdminMessage(chatId, '❌ Ошибка: недостаточно данных для изменения категории.');
      return;
    }
    
    const cityName = await this.getCityNameFromKey(cityKey);
    
    // Находим полный ID места по короткому
    const places = await placeManager.getPlacesByCity(cityName);
    const place = places.find(p => p.id.startsWith(shortPlaceId));
    
    if (!place) {
      await this.sendAdminMessage(chatId, '❌ Место не найдено.');
      return;
    }
    
    // Получаем все категории
    const categories = await categoryManager.getAllCategories();
    
    // Создаем маппинг коротких ID на полные
    const categoryMap = {};
    categories.forEach(cat => {
      const shortId = require('crypto')
        .createHash('md5')
        .update(String(cat.id))
        .digest('hex')
        .substring(0, 4);
      categoryMap[shortId] = cat.id;
    });
    
    // Находим полный ID категории
    const fullCategoryId = categoryMap[shortCategoryId];
    
    if (!fullCategoryId) {
      await this.sendAdminMessage(chatId, '❌ Категория не найдена.');
      return;
    }
    
    // Получаем данные категории для сообщения
    const category = await categoryManager.getCategoryById(fullCategoryId);
    
    // Обновляем категорию места
    const updateData = { 
      category_id: fullCategoryId,
      category_name: category.name,
      category_emoji: category.emoji
    };
    
    console.log(`📝 Обновляю категорию места ${place.id}:`, updateData);
    
    const result = await placeManager.updatePlace(cityName, place.id, updateData);
    
    if (result.success) {
      await this.sendAdminMessage(
        chatId,
        `✅ Категория успешно изменена!\n\n` +
        `🏛️ *Место:* ${place.name}\n` +
        `📁 *Новая категория:* ${category.emoji} ${category.name}`,
        { parse_mode: 'Markdown' }
      );
      
      // Возвращаемся к редактированию места
      setTimeout(async () => {
        await this.showPlaceEditOptions(chatId, cityKey, place.id);
      }, 1000);
    } else {
      await this.sendAdminMessage(chatId, `❌ Ошибка: ${result.message}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при изменении категории:', error);
    await this.sendAdminMessage(chatId, `❌ Произошла ошибка: ${error.message}`);
  }
}

  // ============ ОБРАБОТКА CALLBACK ДЕЙСТВИЙ ============
async processCallbackAction(chatId, userId, action, params, messageId, isAdmin) {
  console.log(`📱 Callback от ${userId}: ${data}`);
  console.log(`🔍 [DEBUG] Полный callback_data: "${data}"`);
  
  try {
    // СРАЗУ отвечаем на callback_query
    await this.bot.answerCallbackQuery(callbackQuery.id);
    
    if (!data || typeof data !== 'string') {
      console.error('❌ Пустой или некорректный callback_data');
      return;
    }
    
    const parts = data.split(':');
    console.log(`🔍 [DEBUG] Разбитые части:`, parts);
    
    // ✅ ИСПРАВЛЕНИЕ: Очищаем и преобразуем каждую часть
    const action = this.cleanCallbackData(parts[0] || '');
    const params = parts.slice(1).map(param => {
      // Преобразуем параметры в строку и очищаем
      let paramStr;
      if (typeof param === 'number') {
        paramStr = param.toString();
      } else if (typeof param === 'string') {
        paramStr = param;
      } else if (param === undefined || param === null) {
        paramStr = '';
      } else {
        paramStr = String(param);
      }
      return this.cleanCallbackData(paramStr);
    });
    
    console.log(`🔍 [DEBUG] Action: ${action}, Params:`, params);
    
    // Ограничиваем максимальное время обработки 8 секундами
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Таймаут обработки callback')), 8000);
    });
    
    // Запускаем обработку с таймаутом
    await Promise.race([
      this.processCallbackActionInternal(chatId, userId, action, params, messageId, isAdmin),
      timeoutPromise
    ]);
    
  } catch (error) {
    console.error(`❌ Ошибка обработки callback для ${userId}: ${error.message}`);
    
    if (error.message !== 'Таймаут обработки callback') {
      try {
        await this.bot.sendMessage(
          chatId,
          '⚠️ Произошла ошибка при обработке запроса. Пожалуйста, попробуйте еще раз.'
        );
      } catch (sendError) {
        console.error(`❌ Не удалось отправить сообщение об ошибке: ${sendError.message}`);
      }
    }
  }
}

// ✅ НОВЫЙ МЕТОД: Внутренняя обработка callback actions
async processCallbackActionInternal(chatId, userId, action, params, messageId, isAdmin) {
  console.log(`🔧 [processCallbackActionInternal] Action: ${action} с параметрами: ${params}`);
  
  switch(action) {
    case 'select_city':
      await this.handleCitySelection(chatId, params[0], isAdmin);
      break;
      
    case 'select_category':
      await this.showPlacesByCategory(chatId, params[0], params[1]);
      break;
      
    case 'copy_coords':
      await this.handleCopyCoords(chatId, params[0], params[1]);
      break;

    case 'copy_phone':
      await this.handleCopyPhone(chatId, params[0], params[1]);
      break;

    case 'edit_social':
      await this.handleEditSocialLinks(chatId, params[0], params[1]);
      break;

    case 'edit_social_field':
      await this.handleEditSocialField(chatId, params[0], params[1], params[2]);
      break;

    case 'confirm_delete_social':
      await this.confirmDeleteSocial(chatId, params[0], params[1], decodeURIComponent(params[2]));
      break;

    case 'edit_social_item':
      await this.handleEditSocialItem(chatId, params[0], params[1], decodeURIComponent(params[2]));
      break;

    case 'delete_social_item':
      await this.handleDeleteSocialItem(chatId, params[0], params[1], decodeURIComponent(params[2]));
      break;

    case 'show_place':
      await this.showPlaceDetails(chatId, params[0], params[1], userId);
      break;
      
    case 'admin_action':
      if (!isAdmin) {
        await this.bot.sendMessage(
          chatId,
          '❌ У вас нет доступа к этой функции.',
          { reply_to_message_id: messageId }
        );
        return;
      }
      this.adminSessions.set(chatId, true);
      
      if (params.length > 1) {
        await this.handleAdminAction(chatId, params[0], params[1], messageId);
      } else {
        await this.handleAdminAction(chatId, params[0], null, messageId);
      }
      break;
      
    case 'admin_city_page':
      if (!isAdmin) return;
      await this.showPlacesForEdit(chatId, await this.getCityNameFromKey(params[0]), parseInt(params[1]));
      break;

    case 'city_cat_page':
      await this.handleCitySelection(chatId, params[0], isAdmin, parseInt(params[1]));
      break;

    case 'user_category_page':
      await this.showPlacesByCategory(chatId, params[0], params[1], parseInt(params[2]));
      break;

    case 'admin_city':
      if (!isAdmin) {
        await this.bot.sendMessage(
          chatId,
          '❌ У вас нет доступа к этой функции.',
          { reply_to_message_id: messageId }
        );
        return;
      }
      
      console.log(`🏙️ Admin city action received: action=${params[0]}, cityKey=${params[1]}`);
      
      if (!params[0] || !params[1]) {
        console.error('❌ Недостаточно параметров для admin_city:', params);
        await this.sendAdminMessage(
          chatId,
          '❌ Ошибка при обработке запроса. Недостаточно данных.'
        );
        return;
      }
      
      this.adminSessions.set(chatId, true);
      await this.handleAdminCityAction(chatId, params[0], params[1], messageId);
      break;
      
    case 'admin_category':
      if (!isAdmin) {
        await this.bot.sendMessage(
          chatId,
          '❌ У вас нет доступа к этой функции.',
          { reply_to_message_id: messageId }
        );
        return;
      }
      this.adminSessions.set(chatId, true);
      await this.handleCategoryCallback(chatId, userId, params[0], params.slice(1), messageId);
      break;
      
    case 'admin_categories':
      if (!isAdmin) {
        await this.bot.sendMessage(
          chatId,
          '❌ У вас нет доступа к этой функции.',
          { reply_to_message_id: messageId }
        );
        return;
      }
      this.adminSessions.set(chatId, true);
      await this.handleCategoriesManagement(chatId, params[0], params[1], messageId);
      break;
      
    case 'back':
      // Сбрасываем админ-сессию при возврате в главное меню
      if (params[0] === 'main_menu') {
        this.adminSessions.delete(chatId);
      }
      await this.handleBackAction(chatId, params[0], isAdmin);
      break;
      
    case 'category_header':
      // Просто обрабатываем, без дополнительных действий
      break;
      
    case 'edit_place_select':
      if (!isAdmin) {
        await this.bot.sendMessage(
          chatId,
          '❌ У вас нет доступа к этой функции.'
        );
        return;
      }
      this.adminSessions.set(chatId, true);
      await this.showPlaceEditOptions(chatId, params[0], params[1]);
      break;
        
    case 'edit_category_select':
      if (!isAdmin) {
        await this.bot.sendMessage(
          chatId,
          '❌ У вас нет доступа к этой функции.',
          { reply_to_message_id: messageId }
        );
        return;
      }
      this.adminSessions.set(chatId, true);
      await this.handleEditCategorySelect(chatId, params[0], messageId);
      break;
      
    case 'edit_category_field':
      if (!isAdmin) {
        await this.bot.sendMessage(
          chatId,
          '❌ У вас нет доступа к этой функции.',
          { reply_to_message_id: messageId }
        );
        return;
      }
      this.adminSessions.set(chatId, true);
      await this.handleEditCategoryField(chatId, params[0], params[1], messageId);
      break;
      
    case 'e_f':
      if (!isAdmin) {
        await this.bot.sendMessage(
          chatId,
          '❌ У вас нет доступа к этой функции.',
          { reply_to_message_id: messageId }
        );
        return;
      }
      
      console.log(`🔍 [DEBUG] e_f params:`, params);
      
      if (params.length < 3) {
        console.error('❌ Недостаточно параметров для e_f:', params);
        await this.sendAdminMessage(
          chatId,
          '❌ Ошибка: недостаточно данных для редактирования.'
        );
        return;
      }
      
      const fieldMap = {
        'n': 'name',
        'a': 'address',
        't': 'working_hours',
        'p': 'average_price',
        'd': 'description',
        'w': 'website',
        's': 'social_links',
        'ph': 'phone',
        'm': 'map_url',
        'c': 'category_id',
        'del': 'delete',
        'confirm_delet': 'confirm_delet',
        'lat': 'latitude',
        'lon': 'longitude',
        'gpid': 'google_place_id'
      };
      
      const shortField = params[2];
      const fullField = fieldMap[shortField];
      
      if (!fullField) {
        console.error('❌ Неизвестное сокращение поля:', shortField);
        await this.sendAdminMessage(
          chatId,
          '❌ Ошибка: неизвестное поле для редактирования.'
        );
        return;
      }
      
      const cityName = await this.getCityNameFromKey(params[0]);
      const places = await placeManager.getPlacesByCity(cityName);
      
      const fullPlaceId = places.find(p => p.id.startsWith(params[1]))?.id;
      
      if (!fullPlaceId) {
        console.error(`❌ Не найден полный ID места для короткого: ${params[1]}`);
        await this.sendAdminMessage(
          chatId,
          '❌ Ошибка: место не найдено.'
        );
        return;
      }
      
      this.adminSessions.set(chatId, true);
      await this.handleEditPlaceField(chatId, params[0], fullPlaceId, fullField, messageId);
      break;
      
    case 'delete_category_confirm':
      if (!isAdmin) {
        await this.bot.sendMessage(
          chatId,
          '❌ У вас нет доступа к этой функции.',
          { reply_to_message_id: messageId }
        );
        return;
      }
      this.adminSessions.set(chatId, true);
      await this.handleDeleteCategoryConfirm(chatId, params[0], params[1], messageId);
      break;
      
    case 'delete_category_cancel':
      if (!isAdmin) {
        await this.bot.sendMessage(
          chatId,
          '❌ У вас нет доступа к этой функции.',
          { reply_to_message_id: messageId }
        );
        return;
      }
      this.adminSessions.set(chatId, true);
      await this.showCategoryManagement(chatId);
      break;
      
    case 'report_issue':
      await this.showIssueOptions(chatId, params[0], params[1]);
      break;
      
    case 'issue':
      // params[0] = cityKey, params[1] = placeId, params[2] = issueType
      await this.handleIssueReport(chatId, params[0], params[1], params[2]);
      break;

    case 'admin_ads':
      if (!isAdmin) {
        await this.bot.sendMessage(chatId, '❌ У вас нет доступа к этой функции.');
        return;
      }
      this.adminSessions.set(chatId, true);
      await this.handleAdsManagement(chatId, params[0]);
      break;
      
    case 'edit_ad_select':
      if (!isAdmin) {
        await this.bot.sendMessage(chatId, '❌ У вас нет доступа к этой функции.');
        return;
      }
      this.adminSessions.set(chatId, true);
      await this.handleEditAdSelect(chatId, params[0]);
      break;
      
    case 'edit_ad_field':
      if (!isAdmin) {
        await this.bot.sendMessage(chatId, '❌ У вас нет доступа к этой функции.');
        return;
      }
      this.adminSessions.set(chatId, true);
      await this.handleEditAdField(chatId, params[0], params[1]);
      break;
      
    case 'delete_ad_confirm':
      if (!isAdmin) {
        await this.bot.sendMessage(chatId, '❌ У вас нет доступа к этой функции.');
        return;
      }
      this.adminSessions.set(chatId, true);
      await this.handleDeleteAdConfirm(chatId, params[0]);
      break;
      
    case 'delete_ad_execute':
      if (!isAdmin) {
        await this.bot.sendMessage(chatId, '❌ У вас нет доступа к этой функции.');
        return;
      }
      this.adminSessions.set(chatId, true);
      await this.executeDeleteAd(chatId, params[0]);
      break;
      
    // ✅ НОВЫЙ CASE ДЛЯ ОБРАБОТКИ СОКРАЩЕННЫХ CALLBACK ДЛЯ КАТЕГОРИЙ
case 'ecat':
  if (!isAdmin) {
    await this.bot.sendMessage(chatId, '❌ У вас нет доступа к этой функции.');
    return;
  }
  
  console.log(`📁 [DEBUG ecat] Обработка выбора категории:`, params);
  
  // ✅ ДОБАВЬТЕ ПРОВЕРКУ: Убедитесь, что params[2] существует
  if (params.length < 3 || !params[2]) {
    console.error('❌ Недостаточно параметров для ecat:', params);
    await this.sendAdminMessage(chatId, '❌ Ошибка: недостаточно данных для выбора категории.');
    return;
  }
  
  this.adminSessions.set(chatId, true);
  await this.handleEditCategorySelectShort(chatId, params[0], params[1], params[2]);
  break;

    default:
      console.warn(`⚠️ Неизвестный action: ${action}`);
      await this.bot.sendMessage(
        chatId,
        '⚠️ Неизвестная команда. Пожалуйста, попробуйте еще раз.',
        { reply_to_message_id: messageId }
      );
  }
}

// Метод тестирования Uber
async testUberLink(chatId, place) {
  const uberLink = this.getUberLinkForPlace(place);
  const googleMapsLink = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&travelmode=driving`;
  
  let message = `🚗 *Тест ссылок Uber*\n\n`;
  message += `📍 *Место:* ${place.name}\n`;
  message += `🌍 *Координаты:* ${place.latitude}, ${place.longitude}\n`;
  message += `📌 *Адрес:* ${place.address || 'нет'}\n`;
  message += `🏷️ *Google Place ID:* ${place.google_place_id || 'нет'}\n\n`;
  message += `*Ссылка Uber:*\n\`${uberLink}\`\n\n`;
  message += `*Проверка:*\n`;
  message += `• Протокол: ${uberLink?.startsWith('https://') ? '✅ HTTPS' : '❌ Не HTTPS'}\n`;
  message += `• Telegram безопасность: ${this.isTelegramSafeUrl(uberLink) ? '✅ Безопасно' : '❌ Небезопасно'}\n`;
  
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '🚗 Открыть Uber', url: uberLink },
        { text: '🗺️ Маршрут', url: googleMapsLink }
      ],
      [
        { text: '🔙 Назад', callback_data: 'admin_action:back_to_panel' }
      ]
    ]
  };
  
  await this.sendAdminMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}

  async handleAdsManagement(chatId, action) {
    switch(action) {
      case 'list':
        await this.showAdsList(chatId);
        break;
        
      case 'add':
        await this.startAddAd(chatId);
        break;
        
      case 'edit':
        await this.startEditAd(chatId);
        break;
        
      case 'delete':
        await this.startDeleteAd(chatId);
        break;
        
      default:
        await this.showAdsManagement(chatId);
    }
  }

  async handleEditAdField(chatId, adId, field) {
    const ad = await this.adsManager.getAdById(adId);
    
    if (!ad) {
      await this.sendAdminMessage(chatId, '❌ Объявление не найдено.');
      return;
    }
    
    this.userStates.set(chatId, {
      action: 'editing_ad',
      step: 'enter_new_value',
      adId: adId,
      editingField: field,
      adData: ad
    });
    
 
    
    const currentValue = ad[field] || 'не указано';
    
  let message = `✏️ *Редактирование: ${this.fieldLabels[field]}*\n\n`;
    message += `Текущее значение: ${currentValue}\n\n`;
    
    if (field === 'text') {
      message += `Введите новый текст объявления (минимум 10 символов):`;
    } else if (field === 'url') {
      message += `Введите новый URL.\n`;
      message += `Для очистки поля отправьте "-":`;
    }
    
    await this.sendAdminMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  async executeDeleteAd(chatId, adId) {
    const result = await this.adsManager.deleteAd(adId);
    
    if (result.success) {
      await this.sendAdminMessage(
        chatId,
        `✅ ${result.message}`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await this.sendAdminMessage(
        chatId,
        `❌ ${result.message}`,
        { parse_mode: 'Markdown' }
      );
    }
    
    setTimeout(async () => {
      await this.showAdsManagement(chatId);
    }, 1000);
  }

  // ============ ОСНОВНЫЕ МЕТОДЫ ИНТЕРФЕЙСА ============
async showMainMenu(chatId, text = 'Выберите действие:', isAdmin = false) {
  // Полностью очищаем все состояния
  this.userStates.delete(chatId);
  this.adminSessions.delete(chatId);
  this.userPhotos.delete(chatId);
  this.lastBotMessages.delete(chatId);
  
  console.log(`🎮 [showMainMenu] Показываю главное меню для ${chatId}, isAdmin: ${isAdmin}`);
  
  // Используем sendAdminMessage для гарантированной отправки (без удаления)
  await this.sendAdminMessage(chatId, `${text}\n\nВыберите действие:`, {
    reply_markup: this.getKeyboardWithMainMenu(isAdmin)
  });
}

 getKeyboardWithMainMenu(isAdmin = false) {
  const keyboard = [
    ['🏙️ Выбрать город'],
    ['📰 Новости'],
    ['📱 Наши медиа']
  ];
  
  if (isAdmin) {
    keyboard.push(['⚙️ Администрирование']);
  }
  
  // Не добавляем "🏠 Главное меню" если мы уже в главном меню
  // Это может вызывать циклические ссылки
  
  return {
    keyboard: keyboard,
    resize_keyboard: true,
    one_time_keyboard: false
  };
}
  // Метод для преобразования inline кнопок в регулярные кнопки
  inlineToRegularKeyboard(inlineKeyboard, isAdmin = false) {
    const keyboard = [];
    
    if (inlineKeyboard && inlineKeyboard.inline_keyboard) {
      for (const row of inlineKeyboard.inline_keyboard) {
        const regularRow = [];
        for (const button of row) {
          // Преобразуем inline кнопки в регулярные
          if (button.text) {
            regularRow.push(button.text);
          }
        }
        if (regularRow.length > 0) {
          keyboard.push(regularRow);
        }
      }
    }
    
    // Добавляем основное меню в конец
    keyboard.push(['🏙️ Выбрать город']);
    keyboard.push(['📰 Новости', '📱 Наши медиа']);
    
    if (isAdmin) {
      keyboard.push(['⚙️ Администрирование']);
    }
    
    keyboard.push(['🏠 Главное меню']);
    
    return {
      keyboard: keyboard,
      resize_keyboard: true,
      one_time_keyboard: false
    };
  }

async showCitySelection(chatId, isAdmin = false) {
  try {
    console.log(`🔍 [showCitySelection] Начинаю для ${chatId}`);
    
    // Добавляем таймаут для запроса к Firebase
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Таймаут получения городов из Firebase (10 секунд)')), 10000);
    });
    
    const citiesPromise = cityManager.getAllCities();
    const cities = await Promise.race([citiesPromise, timeoutPromise]);
    
    console.log(`🔍 [showCitySelection] Получено городов: ${cities.length}`, cities);
    
    if (cities.length === 0) {
      console.log(`⚠️ [showCitySelection] Список городов пуст`);
      await this.sendAdminMessage(
        chatId,
        '📭 Список городов пуст.\n\n' +
        (isAdmin ? 'Вы можете добавить город через панель администратора.' : 'Обратитесь к администратору.')
      );
      return;
    }

    // ✅ СОРТИРУЕМ ГОРОДА ПО АЛФАВИТУ (русский алфавит учитывается)
    const sortedCities = [...cities].sort((a, b) => a.localeCompare(b, 'ru'));

    const message = '🏙️ *Выберите город:*';
    console.log(`🔍 [showCitySelection] Создаю inline-кнопки для ${sortedCities.length} городов`);

    const inlineKeyboard = {
      inline_keyboard: []
    };

    for (let i = 0; i < sortedCities.length; i += 1) {
      const cityKey = this.getCityKey(sortedCities[i]);
      console.log(`🔍 [showCitySelection] Город ${i+1}: "${sortedCities[i]}" -> ключ: "${cityKey}"`);

      inlineKeyboard.inline_keyboard.push([
        {
          text: sortedCities[i],
          callback_data: `select_city:${cityKey}`
        }
      ]);
    }

    console.log(`🔍 [showCitySelection] Отправляю сообщение с клавиатурой`);

    // Попробуем отправить разными способами
    try {
      // Способ 1: через sendAndTrack
      const result = await this.sendAndTrack(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard
      });
      console.log(`✅ [showCitySelection] Сообщение отправлено через sendAndTrack, ID: ${result?.message_id}`);
    } catch (error1) {
      console.error(`❌ [showCitySelection] Ошибка sendAndTrack:`, error1.message);

      try {
        // Способ 2: через sendAdminMessage
        const result2 = await this.sendAdminMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard
        });
        console.log(`✅ [showCitySelection] Сообщение отправлено через sendAdminMessage, ID: ${result2?.message_id}`);
      } catch (error2) {
        console.error(`❌ [showCitySelection] Ошибка sendAdminMessage:`, error2.message);

        try {
          // Способ 3: через прямой вызов bot.sendMessage
          const result3 = await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboard
          });
          console.log(`✅ [showCitySelection] Сообщение отправлено напрямую, ID: ${result3.message_id}`);
        } catch (error3) {
          console.error(`❌ [showCitySelection] Ошибка прямого вызова:`, error3.message);

          // Способ 4: отправить без разметки
          await this.bot.sendMessage(
            chatId,
            '🏙️ Выберите город из списка ниже:\n\n' +
            sortedCities.map(c => `• ${c}`).join('\n') +
            '\n\nНапишите название города:'
          );
        }
      }
    }

    console.log(`✅ [showCitySelection] Завершено для ${chatId}`);

  } catch (error) {
    console.error(`❌ [showCitySelection] Ошибка:`, error);

    if (error.message.includes('Таймаут')) {
      await this.sendAdminMessage(
        chatId,
        '⏱️ *Таймаут запроса*\n\n' +
        'Не удалось получить список городов из Firebase в течение 10 секунд.\n\n' +
        'Возможные причины:\n' +
        '1. Проблемы с подключением к Firebase\n' +
        '2. Слишком медленный ответ от Firebase\n' +
        '3. Ошибка в конфигурации Firebase\n\n' +
        'Проверьте логи Firebase и сетевое подключение.'
      );
    } else {
      await this.sendAdminMessage(
        chatId,
        `❌ Ошибка при загрузке городов: ${error.message}`
      );
    }
  }
}


// 1. handleCitySelection - сортировка категорий с пагинацией
async handleCitySelection(chatId, cityKey, isAdmin, page = 0) {
  const cityName = await this.getCityNameFromKey(cityKey);
  
  this.userStates.set(chatId, { 
    selectedCity: cityName,
    action: 'browsing_city'
  });
  
  const categories = await categoryManager.getAllCategories();
  const stats = await placeManager.getCityStats(cityName);
  const cityData = await cityManager.getCityData(cityName);
  
  // Собираем категории с местами
  const categoriesWithPlaces = [];
  for (const category of categories) {
    const count = stats.categoriesCount[category.id] ? stats.categoriesCount[category.id].count : 0;
    if (count > 0) {
      categoriesWithPlaces.push({ ...category, count });
    }
  }
  
  // Сортируем по алфавиту
  categoriesWithPlaces.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  
  // Если нет категорий с местами — показываем все
  const allCategories = categoriesWithPlaces.length > 0
    ? categoriesWithPlaces
    : [...categories].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  
  // Пагинация: 10 категорий на страницу
  const pageSize = 10;
  const totalPages = Math.ceil(allCategories.length / pageSize);
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = currentPage * pageSize;
  const pageCategories = allCategories.slice(start, start + pageSize);
  
  let message = `🏙️ *${cityName}*\n\n`;
  if (totalPages > 1) {
    message += `Выберите категорию (стр. ${currentPage + 1}/${totalPages}):\n\n`;
  } else {
    message += `Выберите категорию:\n\n`;
  }
  
  // Фото города
  if (cityData && cityData.photo) {
    if (cityData.photo.url) {
      message = `[​](${cityData.photo.url})` + message;
    } else if (cityData.photo.telegramFileId) {
      message = `[​](${cityData.photo.telegramFileId})` + message;
    }
  }
  
  const inlineKeyboard = { inline_keyboard: [] };
  
  // Кнопки категорий по 2 в ряд, БЕЗ числа мест
  for (let i = 0; i < pageCategories.length; i += 2) {
    const row = pageCategories.slice(i, i + 2).map(cat => ({
      text: `${cat.emoji} ${cat.name}`,
      callback_data: `select_category:${cityKey}:${cat.id}`
    }));
    inlineKeyboard.inline_keyboard.push(row);
  }
  
  // Навигация по страницам
  if (totalPages > 1) {
    const navRow = [];
    if (currentPage > 0) {
      navRow.push({ text: '⬅️ Назад', callback_data: `city_cat_page:${cityKey}:${currentPage - 1}` });
    }
    if (currentPage < totalPages - 1) {
      navRow.push({ text: 'Далее ➡️', callback_data: `city_cat_page:${cityKey}:${currentPage + 1}` });
    }
    if (navRow.length > 0) {
      inlineKeyboard.inline_keyboard.push(navRow);
    }
  }
  
  if (isAdmin) {
    inlineKeyboard.inline_keyboard.push([
      { text: '➕ Добавить место', callback_data: `admin_action:add_place:${cityKey}` },
      { text: '✏️ Редактировать место', callback_data: `admin_action:edit_place:${cityKey}` }
    ]);
  }
  
  await this.sendAndTrack(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}

// 2. showPlacesByCategory - сортировка мест
async showPlacesByCategory(chatId, cityKey, categoryId, page = 0) {
    const cityName = await this.getCityNameFromKey(cityKey);
    const userId = this.userStates.get(chatId)?.userId || chatId;
    const isAdmin = this.isUserAdmin(userId);
    
    const places = await placeManager.getPlacesByCategory(cityName, categoryId);
    const category = await categoryManager.getCategoryById(categoryId);
    
    if (places.length === 0) {
      await this.sendAndTrack(chatId, `В категории "${category.emoji} ${category.name}" пока нет мест.\n\nВыберите другую категорию.`);
      return;
    }
    
    const pageSize = 15;
    const totalPages = Math.ceil(places.length / pageSize);
    const start = page * pageSize;
    const end = Math.min(start + pageSize, places.length);
    
    const sortedPlaces = [...places].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    const pagePlaces = sortedPlaces.slice(start, end);
    
    let message = `📍 *${category.emoji} ${category.name} в ${cityName}* (Стр. ${page + 1}/${totalPages})\n\n`;
    message += `Выберите место:`;
    
    const inlineKeyboard = { inline_keyboard: [] };
    
    pagePlaces.forEach(place => {
      const socialIcon = place.social_links && Object.keys(place.social_links).length > 0 ? ' 📱' : '';
      inlineKeyboard.inline_keyboard.push([{
        text: `${place.name}${socialIcon}${place.average_price ? ` (${place.average_price})` : ''}`,
        callback_data: `show_place:${cityKey}:${place.id}`
      }]);
    });

    const navRow = [];
    if (page > 0) navRow.push({ text: '⬅️ Пред.', callback_data: `user_category_page:${cityKey}:${categoryId}:${page - 1}` });
    if (page < totalPages - 1) navRow.push({ text: 'След. ➡️', callback_data: `user_category_page:${cityKey}:${categoryId}:${page + 1}` });
    if (navRow.length > 0) inlineKeyboard.inline_keyboard.push(navRow);
    
    inlineKeyboard.inline_keyboard.push([
      { text: '🔙 К категориям', callback_data: `select_city:${cityKey}` },
      { text: '🏠 Меню', callback_data: 'back:main_menu' }
    ]);
    
    this.cleanInlineKeyboard(inlineKeyboard);
    await this.sendAndTrack(chatId, message, { parse_mode: 'Markdown', reply_markup: inlineKeyboard });
  }

 async showPlacesForEdit(chatId, cityName, page = 0) {
  const places = await placeManager.getPlacesByCity(cityName);
  const cityKey = this.getCityKey(cityName);
  
  if (places.length === 0) {
    await this.sendAdminMessage(chatId, `📭 В городе "${cityName}" нет мест для редактирования.`);
    return;
  }

  const pageSize = 15;
  const totalPages = Math.ceil(places.length / pageSize);
  const start = page * pageSize;
  const end = Math.min(start + pageSize, places.length);
  
  // ✅ ДОБАВЛЕНА СОРТИРОВКА ПО АЛФАВИТУ
  const sortedPlaces = [...places].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const pagePlaces = sortedPlaces.slice(start, end);
  
  let message = `✏️ *Редактирование места в ${cityName}* (Стр. ${page + 1}/${totalPages})\n\n`;
  message += `Выберите место для редактирования:`;
  
  const inlineKeyboard = { inline_keyboard: [] };
  
  pagePlaces.forEach((place, index) => {
    const cleanName = this.cleanButtonText(place.name);
    const displayName = cleanName || `Место ${start + index + 1}`;
    const category = place.category_emoji ? `${place.category_emoji} ` : '';
    
    inlineKeyboard.inline_keyboard.push([{
      text: `${category}${displayName}`,
      callback_data: `edit_place_select:${cityKey}:${place.id}`
    }]);
  });

  const navRow = [];
  if (page > 0) navRow.push({ text: '⬅️ Пред.', callback_data: `admin_city_page:${cityKey}:${page - 1}` });
  if (page < totalPages - 1) navRow.push({ text: 'След. ➡️', callback_data: `admin_city_page:${cityKey}:${page + 1}` });
  if (navRow.length > 0) inlineKeyboard.inline_keyboard.push(navRow);
  
  inlineKeyboard.inline_keyboard.push([
    { text: '🔙 К городам', callback_data: 'admin_action:edit_place' },
    { text: '❌ Отмена', callback_data: 'admin_action:cancel' }
  ]);
  
  this.cleanInlineKeyboard(inlineKeyboard);
  await this.sendAdminMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: inlineKeyboard });
}

async showPlacesForEditSimple(chatId, cityName, places) {
  // ✅ СОРТИРУЕМ МЕСТА ПО АЛФАВИТУ
  const sortedPlaces = [...places].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const inlineKeyboard = {
    inline_keyboard: []
  };

  sortedPlaces.forEach((place, index) => {
    inlineKeyboard.inline_keyboard.push([
      {
        text: `📍 ${place.name}`,
        callback_data: `edit_place_select:${cityName}:${place.id}`
      }
    ]);
  });

  inlineKeyboard.inline_keyboard.push([
    { text: '🔙 Выбрать другой город', callback_data: 'admin_action:edit_place' },
    { text: '❌ Отмена', callback_data: 'admin_action:cancel' },
    { text: '🏠 Главное меню', callback_data: 'back:main_menu' }
  ]);

  await this.sendAdminMessage(
    chatId,
    `✏️ Редактирование места в ${cityName}\n\nВыберите место для редактирования:`,
    { reply_markup: inlineKeyboard }
  );
}

  async handleEditPlaceSelect(chatId, cityKey, placeId, messageId) {
    // Получаем настоящее название города
    const cityName = await this.getCityNameFromKey(cityKey);
    
    const place = await placeManager.getPlaceById(cityName, placeId);
    
    if (!place) {
      await this.sendAdminMessage(chatId, '❌ Место не найдено.');
      return;
    }
    
    this.userStates.set(chatId, {
      action: 'editing_place',
      step: 'select_field',
      city: cityName,
      placeId: placeId,
      placeData: place
    });
    
    const category = await categoryManager.getCategoryById(place.category_id);
    
    let message = `✏️ *Редактирование места:* ${place.name}\n`;
    message += `📁 ${category.emoji} ${category.name}\n\n`;
    message += `Выберите поле для редактирования:`;
    
    // Укорачиваем ID места - берем только первые 8 символов для callback_data

    // Укорачиваем cityKey если он слишком длинный
    const cK = cityKey.length > 15 ? cityKey.substring(0, 15) : cityKey;
    
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '🏛️ Название', callback_data: `e_f:${cityKey}:${placeId}:n` },
          { text: '📍 Адрес', callback_data: `e_f:${cityKey}:${placeId}:a` }
        ],
        [
          { text: '⏰ Время работы', callback_data: `e_f:${cityKey}:${placeId}:t` },
          { text: '💰 Средний чек', callback_data: `e_f:${cityKey}:${placeId}:p` }
        ],
        [
          { text: '📱 Редактировать соцсети', callback_data: `e_f:${cityKey}:${placeId}:s` },
          { text: '🌐 Сайт', callback_data: `e_f:${cityKey}:${placeId}:w` }
        ],
        [
          { text: '📱 Телефон', callback_data: `e_f:${cityKey}:${placeId}:ph` },
          { text: '📍 Карта', callback_data: `e_f:${cityKey}:${placeId}:m` }
        ],
        [ 
          { text: '📝 Описание', callback_data: `e_f:${cityKey}:${placeId}:d` },
          { text: '📁 Категория', callback_data: `e_f:${cityKey}:${placeId}:c` }
        ],
        [
          { text: '🌍 Широта', callback_data: `e_f:${cityKey}:${placeId}:lat` },
          { text: '🌍 Долгота', callback_data: `e_f:${cityKey}:${placeId}:lon` }
        ],
        [
          { text: '🏷️ GPID', callback_data: `e_f:${cityKey}:${placeId}:gpid` }
        ],
        [
          { text: '🗑️ Удалить место', callback_data: `e_f:${cityKey}:${placeId}:del` }
        ],
        [
          { text: '🔙 К выбору места', callback_data: `admin_city:select_for_edit:${cityKey}` },
          { text: '❌ Отмена', callback_data: 'admin_action:cancel' },
          { text: '🏠 Главное меню', callback_data: 'back:main_menu' }
        ]
      ]
    };
    
    await this.sendAdminMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
  }

async handleEditPlaceField(chatId, cityKey, placeId, field, messageId) {
  console.log(`🔍 [DEBUG handleEditPlaceField] Входные параметры:`, {
    cityKey,
    placeId,
    field
  });

  // Если placeId короткий (8 символов), находим полный
  if (placeId.length <= 8) {
    const cityName = await this.getCityNameFromKey(cityKey);
    const places = await placeManager.getPlacesByCity(cityName);
    const fullPlace = places.find(p => p.id.startsWith(placeId));

    if (!fullPlace) {
      await this.bot.sendMessage(chatId, '❌ Место не найдено.');
      return;
    }

    placeId = fullPlace.id;
    console.log(`🔍 Найден полный ID места: ${placeId}`);
  }

  // Получаем настоящее название города
  const actualCityName = await this.getCityNameFromKey(cityKey);
  console.log(`🔍 [DEBUG] actualCityName: "${actualCityName}"`);

  // Получаем данные места
  const place = await placeManager.getPlaceById(actualCityName, placeId);

  if (!place) {
    await this.bot.sendMessage(chatId, '❌ Место не найдено.');
    return;
  }

  // Обработка удаления места
  if (field === 'delete') {
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { 
            text: '✅ Да, удалить', 
            callback_data: `e_f:${cityKey}:${placeId}:confirm_delet` 
          },
          { 
            text: '❌ Нет, отмена', 
            callback_data: `edit_place_select:${cityKey}:${placeId}` 
          }
        ]
      ]
    };

    await this.bot.sendMessage(
      chatId,
      `🗑️ *Удаление места*\n\n` +
      `⚠️ Вы уверены, что хотите удалить место "${place.name}"?\n\n` +
      `Это действие необратимо!`,
      {
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard
      }
    );
    return;
  }

  // Обработка подтверждения удаления
  if (field === 'confirm_delet') {
    console.log(`🗑️ [DEBUG] Удаление места ID: ${placeId} из города: ${actualCityName}`);

    const result = await placeManager.deletePlace(actualCityName, placeId);

    if (result.success) {
      await this.bot.sendMessage(
        chatId,
        `✅ Место "${place.name}" успешно удалено!`,
        { parse_mode: 'Markdown' }
      );

      // Показываем админ-панель через 1 секунду
      setTimeout(async () => {
        await this.showAdminPanel(chatId);
      }, 1000);
    } else {
      await this.bot.sendMessage(
        chatId,
        `❌ Ошибка при удалении: ${result.message}`,
        { parse_mode: 'Markdown' }
      );
    }
    return;
  }

  // Редактирование поля категории - ПОЛНОСТЬЮ ИЗМЕНЕННЫЙ КОД
  if (field === 'category_id') {
    const categories = await categoryManager.getAllCategories();
    
    let message = `✏️ *Выбор новой категории*\n\n`;
    message += `*Место:* ${place.name}\n`;
    message += `*Текущая категория:* ${place.category_emoji || ''} ${place.category_name || 'не указана'}\n\n`;
    message += `Выберите новую категорию:`;
    
    const inlineKeyboardForCategory = {
      inline_keyboard: []
    };
    
// ✅ ИСПРАВЛЕНИЕ 1: Используем сокращенные ID категорий
// Маппинг полных ID категорий на короткие
const categoryShortIds = {};
categories.forEach((cat, index) => {
  // Создаем короткий ID (первые 4 символа MD5 хеша)
  const shortId = require('crypto')
    .createHash('md5')
    .update(String(cat.id))  // ✅ ПРЕОБРАЗУЕМ В СТРОКУ
    .digest('hex')
    .substring(0, 4);
  categoryShortIds[cat.id] = shortId;
});
    
    // Группируем категории по 2 в ряд
    for (let i = 0; i < categories.length; i += 2) {
      const row = categories.slice(i, i + 2).map(cat => {
        // ✅ ИСПРАВЛЕНИЕ 2: Используем короткие callback_data
        const shortCatId = categoryShortIds[cat.id];
        const callbackData = `ecat:${cityKey}:${placeId.substring(0, 8)}:${shortCatId}`;
        
        // ✅ ИСПРАВЛЕНИЕ 3: Очищаем callback_data
        const cleanCallbackData = this.cleanCallbackData(callbackData);
        
        return {
          text: `${cat.emoji} ${this.cleanButtonText(cat.name)}`,
          callback_data: cleanCallbackData
        };
      });
      inlineKeyboardForCategory.inline_keyboard.push(row);
    }
    
    // Кнопка "Назад" с очищенным callback_data
    inlineKeyboardForCategory.inline_keyboard.push([
      { 
        text: '🔙 Назад', 
        callback_data: this.cleanCallbackData(`edit_place_select:${cityKey.substring(0, 15)}:${placeId.substring(0, 8)}`)
      }
    ]);
    
    // ✅ ИСПРАВЛЕНИЕ 4: Обязательно чистим всю клавиатуру
    this.cleanInlineKeyboard(inlineKeyboardForCategory);
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboardForCategory
    });
    return;
  }

  // Редактирование других полей (остается без изменений)
  const currentValue = place[field] || 'не указано';

  // Сохраняем состояние для следующего шага
  this.userStates.set(chatId, {
    action: 'editing_field',
    step: 'enter_new_value',
    cityKey: cityKey,
    placeId: placeId,
    editingField: field,
    placeData: place,
    timestamp: Date.now()
  });

  let message = `✏️ *Редактирование: ${this.fieldLabels[field] || field}*\n\n`;
  message += `*Место:* ${place.name}\n`;
  
  // Особый формат для каждого поля
  switch(field) {
    case 'social_links':
      if (place.social_links && Object.keys(place.social_links).length > 0) {
        message += `*Текущие социальные сети:*\n`;
        Object.entries(place.social_links).forEach(([name, url]) => {
          message += `• ${name}: ${url}\n`;
        });
        message += `\n`;
      } else {
        message += `*Текущие социальные сети:* не добавлены\n\n`;
      }
      message += `📝 *Формат ввода:*\n`;
      message += `Каждая соцсеть с новой строки в формате:\n`;
      message += `Название: URL\n\n`;
      message += `*Пример:*\n`;
      message += `Instagram: https://instagram.com/place\n`;
      message += `Facebook: https://facebook.com/place\n\n`;
      message += `Для удаления всех соцсетей отправьте "-":`;
      break;
      
    case 'latitude':
    case 'longitude':
      message += `*Текущее значение:* ${currentValue}\n\n`;
      message += `Введите новое значение координаты (например: ${field === 'latitude' ? '45.123456' : '34.567890'}).\n`;
      message += `Для очистки поля отправьте "-":`;
      break;
      
    case 'google_place_id':
      message += `*Текущее значение:* ${currentValue}\n\n`;
      message += `Введите новый Google Place ID.\n`;
      message += `*Пример:* ChIJN1t_tDeuEmsRUsoyG83frY4\n`;
      message += `Для очистки поля отправьте "-":`;
      break;
      
    case 'website':
      message += `*Текущее значение:* ${currentValue}\n\n`;
      message += `Введите новый URL сайта.\n`;
      message += `*Пример:* https://example.com\n`;
      message += `Для очистки поля отправьте "-":`;
      break;
      
    case 'phone':
      message += `*Текущее значение:* ${currentValue}\n\n`;
      message += `Введите новый номер телефона.\n`;
      message += `*Рекомендуемый формат:* +7 999 123-45-67\n`;
      message += `Для очистки поля отправьте "-":`;
      break;
      
    case 'map_url':
      message += `*Текущее значение:* ${currentValue}\n\n`;
      message += `Введите новую ссылку на карту.\n`;
      message += `*Пример:* https://goo.gl/maps/AbC123DeF456\n`;
      message += `Для очистки поля отправьте "-":`;
      break;
      
    case 'average_price':
      message += `*Текущее значение:* ${currentValue}\n\n`;
      message += `Введите новую ценовую категорию.\n`;
      message += `*Пример:* 1000-2000 руб, $$$, средний\n`;
      message += `Для очистки поля отправьте "-":`;
      break;
      
    default:
      message += `*Текущее значение:* ${currentValue}\n\n`;
      message += `Введите новое значение (для очистки поля отправьте "-"):`;
  }

  // Создаем клавиатуру с кнопкой отмены
  const replyMarkup = {
    keyboard: [[{ text: '❌ Отменить редактирование' }]],
    resize_keyboard: true,
    one_time_keyboard: true
  };

  // Для поля соцсетей добавляем дополнительную кнопку для удобного редактирования
  if (field === 'social_links') {
    replyMarkup.keyboard.unshift([{ text: '📱 Открыть редактор соцсетей' }]);
  }

  await this.bot.sendMessage(chatId, message, { 
    parse_mode: 'Markdown',
    reply_markup: replyMarkup
  });
}


async showPlaceEditOptions(chatId, cityKey, placeId) {
  const cityName = await this.getCityNameFromKey(cityKey);
  const place = await placeManager.getPlaceById(cityName, placeId);
  
  if (!place) {
    await this.bot.sendMessage(chatId, '❌ Место не найдено.');
    return;
  }
  
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '✏️ Название', callback_data: `e_f:${cityKey}:${placeId}:n` },
        { text: '🏠 Адрес', callback_data: `e_f:${cityKey}:${placeId}:a` }
      ],
      [
        { text: '⏰ Время работы', callback_data: `e_f:${cityKey}:${placeId}:t` },
        { text: '💰 Средний чек', callback_data: `e_f:${cityKey}:${placeId}:p` }
      ],
      [
        { text: '📝 Описание', callback_data: `e_f:${cityKey}:${placeId}:d` },
        { text: '🌐 Сайт', callback_data: `e_f:${cityKey}:${placeId}:w` }
      ],
      [
        { text: '📞 Телефон', callback_data: `e_f:${cityKey}:${placeId}:ph` },
        { text: '🗺️ Карта', callback_data: `e_f:${cityKey}:${placeId}:m` }
      ],
      [
        { text: '📍 Широта', callback_data: `e_f:${cityKey}:${placeId}:lat` },
        { text: '📍 Долгота', callback_data: `e_f:${cityKey}:${placeId}:lon` }
      ],
      [
        { text: '🏷️ Категория', callback_data: `e_f:${cityKey}:${placeId}:c` }
      ],
      [
        { text: '🗑️ Удалить место', callback_data: `e_f:${cityKey}:${placeId}:del` }
      ],
      [
        { text: '🔙 Назад к списку мест', callback_data: `admin_action:edit_places:${cityKey}` }
      ]
    ]
  };
  
  await this.bot.sendMessage(
    chatId,
    `📝 *Редактирование места*\n\n` +
    `*${place.name}*\n\n` +
    `Выберите поле для редактирования:`,
    {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    }
  );
}

startCleanupInterval() {
  // Очистка устаревших состояний каждые 10 минут
  setInterval(() => {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 минут
    
    for (const [chatId, state] of this.userStates.entries()) {
      if (state.timestamp && (now - state.timestamp) > timeout) {
        this.userStates.delete(chatId);
        console.log(`🧹 Очищено устаревшее состояние для чата ${chatId}`);
        
        // Уведомляем пользователя, если он в процессе редактирования
        if (state.action === 'editing_field') {
          this.bot.sendMessage(chatId, '⚠️ Ваша сессия редактирования истекла. Пожалуйста, начните заново.', {
            reply_markup: { remove_keyboard: true }
          });
        }
      }
    }
  }, 10 * 60 * 1000); // Каждые 10 минут
}

async processFieldEdit(chatId, text, state) {
  try {
    const { cityKey, placeId, editingField } = state;

    // Получаем актуальные данные места
    const cityName = await this.getCityNameFromKey(cityKey);

    let newValue = text;

    // Обработка специальных значений
    if (newValue === '-') {
      newValue = '';
    }

    // Обработка кнопки "Открыть редактор соцсетей"
    if (text === '📱 Открыть редактор соцсетей') {
      this.userStates.delete(chatId);
      await this.handleEditSocialLinks(chatId, cityKey, placeId);
      return;
    }

    // Валидация для различных полей
    switch(editingField) {
      case 'latitude':
      case 'longitude':
        if (newValue !== '') {
          const numValue = parseFloat(newValue.replace(',', '.'));
          if (isNaN(numValue)) {
            await this.bot.sendMessage(chatId, '❌ Пожалуйста, введите числовое значение (например: 39.4699).');
            return;
          }
          
          // Дополнительная проверка для координат
          if (editingField === 'latitude' && (numValue < -90 || numValue > 90)) {
            await this.bot.sendMessage(chatId, '❌ Широта должна быть от -90 до 90 градусов.');
            return;
          }
          if (editingField === 'longitude' && (numValue < -180 || numValue > 180)) {
            await this.bot.sendMessage(chatId, '❌ Долгота должна быть от -180 до 180 градусов.');
            return;
          }
          
          newValue = numValue;
        }
        break;
        
      case 'average_price':
        if (newValue !== '' && !isNaN(parseInt(newValue))) {
          const numValue = parseInt(newValue);
          if (numValue < 0) {
            await this.bot.sendMessage(chatId, '❌ Пожалуйста, введите положительную сумму.');
            return;
          }
        }
        break;
        
      case 'website':
        if (newValue !== '') {
          if (!newValue.startsWith('http://') && !newValue.startsWith('https://')) {
            newValue = 'https://' + newValue;
          }
          // Простая валидация URL
          try {
            new URL(newValue);
          } catch (error) {
            await this.bot.sendMessage(chatId, '❌ Неверный формат URL. Пожалуйста, введите корректный URL.');
            return;
          }
        }
        break;
        
      case 'phone':
        if (newValue !== '') {
          // Базовая валидация телефона
          const phoneRegex = /^[+\d\s\-\(\)\.]{5,20}$/;
          if (!phoneRegex.test(newValue)) {
            await this.bot.sendMessage(
              chatId,
              '❌ Неверный формат номера телефона.\n\n' +
              'Примеры правильных форматов:\n' +
              '• +7 (999) 123-45-67\n' +
              '• 89991234567\n' +
              '• 8 (999) 123-45-67\n\n' +
              'Пожалуйста, введите номер заново:'
            );
            return;
          }
        }
        break;
        
      case 'map_url':
        if (newValue !== '') {
          // Проверяем, что это валидный URL
          try {
            new URL(newValue);
          } catch (error) {
            await this.bot.sendMessage(chatId, '❌ Неверный формат URL. Пожалуйста, введите корректную ссылку.');
            return;
          }
        }
        break;
        
       case 'social_links':
      let socialLinks = {};
      
      if (newValue !== '') {
        // Парсим введенные соцсети
        const lines = newValue.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          // 🔴 ИСПРАВЛЕНИЕ: Ищем первое двоеточие с пробелом
          const firstColonIndex = line.indexOf(': ');
          
          if (firstColonIndex === -1) {
            // Пробуем найти просто двоеточие
            const simpleColonIndex = line.indexOf(':');
            if (simpleColonIndex === -1) {
              await this.bot.sendMessage(
                chatId,
                `❌ Неверный формат строки: "${line}".\n\n` +
                'Используйте формат: Название: URL\n' +
                'Пример: Instagram: https://instagram.com/place\n\n' +
                'Пожалуйста, исправьте и попробуйте снова:'
              );
              return;
            }
            
            const name = line.substring(0, simpleColonIndex).trim();
            const url = line.substring(simpleColonIndex + 1).trim();
            
            if (name && url) {
              const normalizedUrl = this.normalizeSocialUrl(url);
              if (this.isValidSocialUrl(normalizedUrl)) {
                socialLinks[name] = normalizedUrl;
              } else {
                await this.bot.sendMessage(
                  chatId,
                  `❌ Неверный URL для "${name}".\n\n` +
                  'Пожалуйста, введите корректный URL:'
                );
                return;
              }
            }
          } else {
            // Используем первое двоеточие с пробелом как разделитель
            const name = line.substring(0, firstColonIndex).trim();
            const url = line.substring(firstColonIndex + 1).trim();
            
            if (name && url) {
              const normalizedUrl = this.normalizeSocialUrl(url);
              if (this.isValidSocialUrl(normalizedUrl)) {
                socialLinks[name] = normalizedUrl;
              } else {
                await this.bot.sendMessage(
                  chatId,
                  `❌ Неверный URL для "${name}".\n\n` +
                  'Пожалуйста, введите корректный URL:'
                );
                return;
              }
            }
          }
        }
      }
      
      newValue = socialLinks;
      break; 
      case 'google_place_id':
        if (newValue !== '') {
          // Базовая валидация Google Place ID
          const placeIdRegex = /^[A-Za-z0-9_-]{27,}$/;
          if (!placeIdRegex.test(newValue)) {
            await this.bot.sendMessage(
              chatId,
              '❌ Неверный формат Google Place ID.\n\n' +
              'Google Place ID обычно содержит 27 или более символов (буквы, цифры, дефисы и подчеркивания).\n\n' +
              'Пожалуйста, введите корректный ID:'
            );
            return;
          }
        }
        break;
        
      case 'name':
        if (newValue.length < 2) {
          await this.bot.sendMessage(chatId, '❌ Название должно содержать минимум 2 символа.');
          return;
        }
        break;
        
      case 'address':
        if (newValue.length < 5) {
          await this.bot.sendMessage(chatId, '❌ Адрес должен содержать минимум 5 символов.');
          return;
        }
        break;
        
      case 'description':
        if (newValue.length < 10) {
          await this.bot.sendMessage(chatId, '❌ Описание должно содержать минимум 10 символов.');
          return;
        }
        break;
    }

    // Создаем объект для обновления
    const updateData = {
      [editingField]: newValue
    };

    // Используем существующий метод updatePlace
    console.log(`📝 Обновляю место ${placeId} в городе ${cityName}, поле: ${editingField}`);
    const result = await placeManager.updatePlace(cityName, placeId, updateData);

    if (result.success) {
      // Очищаем состояние
      this.userStates.delete(chatId);

      // Отправляем подтверждение
      let successMessage = `✅ Поле "${this.fieldLabels[editingField] || editingField}" успешно обновлено!`;
      
      // Особое сообщение для социальных сетей
      if (editingField === 'social_links') {
        if (Object.keys(newValue).length > 0) {
          successMessage += `\n\n📱 *Добавлено соцсетей:* ${Object.keys(newValue).length}\n`;
          Object.entries(newValue).forEach(([name, url]) => {
            successMessage += `• ${this.getSocialIcon(url)} ${name}\n`;
          });
        } else {
          successMessage += '\n\n📭 Социальные сети удалены.';
        }
      }

      await this.bot.sendMessage(chatId, successMessage, {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true }
      });

      // Ждем 1 секунду и показываем обновленное место
      setTimeout(async () => {
        await this.showPlaceDetails(chatId, cityKey, placeId);
      }, 1000);

    } else {
      throw new Error(result.message || 'Неизвестная ошибка при обновлении');
    }

  } catch (error) {
    console.error('❌ Ошибка при сохранении:', error);
    await this.bot.sendMessage(chatId, `❌ Ошибка при сохранении: ${error.message}`);
    this.userStates.delete(chatId);
  }
}


async handleAddingCategory(chatId, msg, state) {
  const text = msg.text;
  
  console.log(`🔍 [DEBUG handleAddingCategory] State:`, { step: state.step, city: state.city, action: state.action });
  
  if (text === '/cancel' || text.toLowerCase() === 'отмена') {
    this.userStates.delete(chatId);
    await this.sendAdminMessage(chatId, '❌ Создание категории отменено.');
    await this.showAdminPanel(chatId);
    return;
  }
  
  switch(state.step) {
    case 'enter_name':
      if (!text || text.trim().length < 2) {
        await this.sendAdminMessage(
          chatId,
          '❌ Название категории должно содержать минимум 2 символа.\nПожалуйста, введите название заново:'
        );
        return;
      }
      
      state.categoryName = text.trim();
      state.step = 'enter_emoji';
      this.userStates.set(chatId, state);
      
      await this.sendAdminMessage(
        chatId,
        `✅ Название сохранено: *${state.categoryName}*\n\n` +
        `🎨 Теперь отправьте эмодзи для этой категории (например: 🍕, 🎨, 🏛️).\n` +
        `Для пропуска отправьте "-":`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'enter_emoji':
      const emoji = text.trim() === '-' ? '📁' : text.trim();
      const result = await categoryManager.addCategory(state.categoryName, emoji);
      
      if (result.success) {
        await this.sendAdminMessage(
          chatId,
          `✅ Категория "${emoji} ${state.categoryName}" успешно создана!`,
          { parse_mode: 'Markdown' }
        );
        
        console.log(`✅ [DEBUG handleAddingCategory] Category created, state.city:`, state.city);
        
        if (state.city && state.city.trim() !== '') {
          const newState = {
            action: 'adding_place',
            step: 'select_category',
            city: state.city,
            placeData: {}
          };
          this.userStates.set(chatId, newState);
          await this.sendAdminMessage(
            chatId,
            `Теперь выберите категорию для нового места:`,
            { parse_mode: 'Markdown' }
          );
          await this.showCategorySelection(chatId, state.city);
        } else {
          console.log(`ℹ️ [DEBUG handleAddingCategory] No city, returning to category management`);
          this.userStates.delete(chatId);
          await this.showCategoryManagement(chatId);
        }
      } else {
        await this.sendAdminMessage(chatId, `❌ ${result.message}`);
        state.step = 'enter_name';
        this.userStates.set(chatId, state);
        await this.sendAdminMessage(
          chatId,
          'Пожалуйста, введите другое название категории:'
        );
      }
      break;
  }
}

async handleCreateCategory(chatId, categoryName, state) {
  if (!categoryName || categoryName.trim().length < 2) {
    await this.sendAdminMessage(
      chatId,
      '❌ Название категории должно содержать минимум 2 символа.\nПожалуйста, введите название заново:'
    );
    return;
  }
  
  await this.sendAdminMessage(
    chatId,
    `📝 Название категории: *${categoryName.trim()}*\n\n` +
    `🎨 Теперь отправьте эмодзи для этой категории (например: 🍕, 🎨, 🏛️).\n` +
    `Для пропуска отправьте "-":`,
    { parse_mode: 'Markdown' }
  );
  
  state.tempCategoryName = categoryName.trim();
  state.step = 'create_category_emoji';
  this.userStates.set(chatId, state);
}

async handleCreateCategoryEmoji(chatId, emoji, state) {
  const categoryName = state.tempCategoryName;
  const categoryEmoji = emoji === '-' ? '📁' : emoji.trim();
  
  const result = await categoryManager.addCategory(categoryName, categoryEmoji);
  
  if (result.success) {
    state.placeData.category_id = result.category.id;
    state.placeData.category_name = result.category.name;
    state.placeData.category_emoji = result.category.emoji;
    state.step = 'enter_name';
    delete state.tempCategoryName;
    this.userStates.set(chatId, state);
    
    await this.sendAdminMessage(
      chatId,
      `✅ ${result.message}\n\nТеперь введите название места:`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await this.sendAdminMessage(chatId, `❌ ${result.message}`);
    state.step = 'select_category';
    this.userStates.set(chatId, state);
    
    if (state.city && state.city.trim() !== '') {
      await this.showCategorySelection(chatId, state.city);
    } else {
      console.error(`❌ [DEBUG handleCreateCategoryEmoji] state.city is invalid:`, state.city);
      await this.sendAdminMessage(chatId, '❌ Ошибка: город не определен. Начните заново.');
      await this.showAdminPanel(chatId);
    }
  }
}

async handleEditCategorySelect(chatId, categoryId, messageId) {
  const category = await categoryManager.getCategoryById(categoryId);
  
  if (!category || !category.isCustom) {
    await this.sendAdminMessage(
      chatId,
      '❌ Категория не найдена или является стандартной.\nРедактировать можно только пользовательские категории.'
    );
    return;
  }
  
  this.userStates.set(chatId, {
    action: 'editing_category',
    step: 'select_field',
    categoryId: categoryId,
    category: category
  });
  
  let message = `✏️ *Редактирование категории:*\n\n`;
  message += `${category.emoji} *${category.name}*\n\n`;
  message += `Выберите что хотите изменить:`;
  
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '🏷️ Изменить название', callback_data: `edit_category_field:${categoryId}:name` },
        { text: '🎨 Изменить эмодзи', callback_data: `edit_category_field:${categoryId}:emoji` }
      ],
      [
        { text: '🔙 Назад к списку', callback_data: 'admin_categories:edit' },
        { text: '❌ Отмена', callback_data: 'admin_action:manage_categories' }
      ]
    ]
  };
  
  await this.sendAdminMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}




async handleEditCategoryField(chatId, categoryId, field, messageId) {
  const category = await categoryManager.getCategoryById(categoryId);
  
  if (!category || !category.isCustom) {
    await this.sendAdminMessage(
      chatId,
      '❌ Категория не найдена или является стандартной.'
    );
    return;
  }
  
  this.userStates.set(chatId, {
    action: 'editing_category',
    step: 'enter_new_value',
    categoryId: categoryId,
    editingField: field,
    category: category
  });
  

  
  const currentValue = field === 'name' ? category.name : category.emoji;
  
  let message = `✏️ *Изменение ${this.fieldLabels[field]} категории*\n\n`;
  message += `Текущее значение: ${currentValue}\n\n`;
  
  if (field === 'name') {
    message += `Введите новое название категории (минимум 2 символа):`;
  } else {
    message += `Введите новый эмодзи (например: 🍕, 🎨, 🏛️):`;
  }
  
  await this.sendAdminMessage(chatId, message, { parse_mode: 'Markdown' });
}

async handleEditingCategory(chatId, msg, state) {
  const text = msg.text;
  
  if (text === '/cancel' || text.toLowerCase() === 'отмена') {
    this.userStates.delete(chatId);
    await this.sendAdminMessage(chatId, '❌ Редактирование категории отменено.');
    await this.showCategoryManagement(chatId);
    return;
  }
  
  if (state.step === 'enter_new_value') {
    const field = state.editingField;
    const categoryId = state.categoryId;
    
    let updateData = {};
    let validationError = null;
    
    if (field === 'name') {
      if (!text || text.trim().length < 2) {
        validationError = 'Название категории должно содержать минимум 2 символа.';
      } else {
        updateData.name = text.trim();
      }
    } else if (field === 'emoji') {
      if (!text || text.trim().length === 0) {
        updateData.emoji = '📁';
      } else {
        updateData.emoji = text.trim();
      }
    }
    
    if (validationError) {
      await this.sendAdminMessage(
        chatId,
        `❌ ${validationError}\n\nПожалуйста, введите значение заново:`
      );
      return;
    }
    
    const result = await categoryManager.updateCategory(categoryId, updateData);
    
    if (result.success) {
      await this.sendAdminMessage(
        chatId,
        `✅ Категория успешно обновлена!\n\n` +
        `Новое значение: ${field === 'name' ? updateData.name : updateData.emoji}\n\n` +
        `Что дальше?`,
        {
          reply_markup: {
            keyboard: [
              ['✏️ Продолжить редактирование', '✅ Завершить'],
              ['🔙 К управлению категориями', '❌ Отмена']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
      
      state.step = 'after_edit';
      this.userStates.set(chatId, state);
    } else {
      await this.sendAdminMessage(
        chatId,
        `❌ Ошибка при обновлении категории: ${result.message}\n\nПопробуйте еще раз:`
      );
    }
  } else if (state.step === 'after_edit') {
    if (text === '✏️ Продолжить редактирование') {
      await this.handleEditCategorySelect(chatId, state.categoryId, null);
    } else if (text === '✅ Завершить') {
      await this.sendAdminMessage(
        chatId,
        `✅ Редактирование категории завершено!`,
        { reply_markup: { remove_keyboard: true } }
      );
      this.userStates.delete(chatId);
      await this.showCategoryManagement(chatId);
    } else if (text === '🔙 К управлению категориями') {
      await this.sendAdminMessage(
        chatId,
        'Возвращаемся к управлению категориями...',
        { reply_markup: { remove_keyboard: true } }
      );
      this.userStates.delete(chatId);
      await this.showCategoryManagement(chatId);
    }
  }
}

async forceSyncToFirebase(chatId) {
  try {
    await this.sendAdminMessage(chatId, '⏳ Принудительная синхронизация с Firebase...');
    
    if (!this.firebaseDB || !this.firebaseDB.initialized) {
      await this.sendAdminMessage(chatId, '❌ Firebase Database не инициализирована.');
      return;
    }
    
    const result = await this.firebaseDB.forceSync();
    
    if (result.success) {
      await this.sendAdminMessage(
        chatId,
        `✅ Синхронизация завершена!\n\n` +
        `📊 Городов: ${result.cities || 0}\n` +
        `📍 Мест: ${result.places || 0}\n` +
        `📁 Категорий: ${result.categories || 0}\n` +
        `📢 Рекламы: ${result.ads || 0}`
      );
    } else {
      await this.sendAdminMessage(chatId, `❌ Ошибка синхронизации: ${result.error || 'Неизвестная ошибка'}`);
    }
  } catch (error) {
    console.error('❌ Ошибка при forceSyncToFirebase:', error);
    await this.sendAdminMessage(chatId, `❌ Ошибка: ${error.message}`);
  }
}

async showFirebaseStatus(chatId) {
  let status = '🔥 *Статус Firebase:*\n\n';
  
  // Firebase Database
  status += `*Database:*\n`;
  status += `  Инициализирована: ${this.firebaseDB?.initialized ? '✅' : '❌'}\n`;
  status += `  Объект db: ${this.firebaseDB?.db ? '✅' : '❌'}\n\n`;
  
  // Firebase Storage
  status += `*Storage:*\n`;
  status += `  Инициализирован: ${this.firebaseStorage?.initialized ? '✅' : '❌'}\n`;
  status += `  Bucket: ${this.firebaseStorage?.bucketName || 'не указан'}\n\n`;
  
  // Менеджеры
  status += `*Менеджеры:*\n`;
  status += `  CategoryManager: ${categoryManager.firebaseDB?.initialized ? '✅' : '❌'}\n`;
  status += `  CityManager: ${cityManager.firebaseDB?.initialized ? '✅' : '❌'}\n`;
  status += `  PlaceManager: ${placeManager.firebaseDB?.initialized ? '✅' : '❌'}\n`;
  status += `  AdsManager: ${adsManager.firebaseDB?.initialized ? '✅' : '❌'}\n`;
  
  // Тест чтения
  try {
    const cities = await cityManager.getAllCities();
    status += `\n📊 *Данные:*\n`;
    status += `  Городов: ${cities.length}\n`;
    
    const categories = await categoryManager.getAllCategories();
    status += `  Категорий: ${categories.length}\n`;
    
    const ads = await adsManager.getAllAds();
    status += `  Объявлений: ${ads.length}\n`;
  } catch (error) {
    status += `\n❌ Ошибка чтения: ${error.message}\n`;
  }
  
  await this.sendAdminMessage(chatId, status, { parse_mode: 'Markdown' });
}

async handleAddingCity(chatId, msg, state) {
  const text = msg.text;

  switch (state.step) {
    case 'enter_name':
      if (!text || text.trim().length === 0) {
        await this.sendAdminMessage(chatId, '❌ Название города не может быть пустым.');
        return;
      }

      // Сохраняем название и переходим к добавлению фото
      state.cityName = text.trim();
      state.step = 'add_photo';
      this.userStates.set(chatId, state);

      await this.sendAdminMessage(
        chatId,
        `✅ Название города сохранено: *${state.cityName}*\n\n` +
        `🖼️ Теперь отправьте фото города или нажмите /skip для пропуска:`,
        { parse_mode: 'Markdown' }
      );
      break;

    case 'add_photo':
      // Если пользователь отправил фото
      if (msg.photo) {
        const photo = msg.photo[msg.photo.length - 1];
        state.photoFileId = photo.file_id;
        state.step = 'finish';
        this.userStates.set(chatId, state);

        await this.sendAdminMessage(chatId, '✅ Фото сохранено!');
        await this.finishAddingCity(chatId, state);
      } else if (text === '/skip') {
        state.step = 'finish';
        this.userStates.set(chatId, state);

        await this.sendAdminMessage(chatId, '⏭️ Фото пропущено.');
        await this.finishAddingCity(chatId, state);
      } else {
        await this.sendAdminMessage(chatId, '❌ Пожалуйста, отправьте фото или напишите /skip');
      }
      break;
  }
}

getSocialNameFromUrl(url) {
  if (!url || typeof url !== 'string') return 'Ссылка';

  const urlLower = url.toLowerCase();

  const socialDomains = {
    'instagram.com': 'Instagram',
    'facebook.com': 'Facebook',
    'vk.com': 'VK',
    'twitter.com': 'Twitter',
    'x.com': 'X (Twitter)',
    'tiktok.com': 'TikTok',
    'youtube.com': 'YouTube',
    'telegram.org': 'Telegram',
    't.me': 'Telegram',
    'whatsapp.com': 'WhatsApp',
    'linkedin.com': 'LinkedIn',
    'pinterest.com': 'Pinterest',
    'snapchat.com': 'Snapchat',
    'reddit.com': 'Reddit',
    'discord.com': 'Discord',
    'twitch.tv': 'Twitch',
    'spotify.com': 'Spotify',
    'apple.com/music': 'Apple Music',
    'soundcloud.com': 'SoundCloud',
    'github.com': 'GitHub',
    'medium.com': 'Medium',
    'tripadvisor.com': 'TripAdvisor',
    'yelp.com': 'Yelp',
    'foursquare.com': 'Foursquare',
    'google.com/maps': 'Google Maps',
    'yandex.ru/maps': 'Яндекс.Карты'
  };

  for (const [domain, name] of Object.entries(socialDomains)) {
    if (urlLower.includes(domain)) {
      return name;
    }
  }

  // Определяем по паттерну
  if (urlLower.includes('instagram')) return 'Instagram';
  if (urlLower.includes('facebook')) return 'Facebook';
  if (urlLower.includes('vk')) return 'VK';
  if (urlLower.includes('twitter') || urlLower.includes('x.com')) return 'Twitter';
  if (urlLower.includes('tiktok')) return 'TikTok';
  if (urlLower.includes('youtube')) return 'YouTube';
  if (urlLower.includes('telegram') || urlLower.includes('t.me')) return 'Telegram';
  if (urlLower.includes('whatsapp')) return 'WhatsApp';
  if (urlLower.includes('linkedin')) return 'LinkedIn';

  return 'Ссылка';
}

async showAllPlaces(chatId) {
  const cities = await cityManager.getAllCities();

  if (cities.length === 0) {
    await this.sendAdminMessage(chatId, '📭 Нет городов с местами.');
    return;
  }

  // ✅ СОРТИРУЕМ ГОРОДА ПО АЛФАВИТУ
  const sortedCities = [...cities].sort((a, b) => a.localeCompare(b, 'ru'));

  let message = '📋 *Все места по городам:*\n\n';

  for (const city of sortedCities) {
    const places = await placeManager.getPlacesByCity(city);

    if (places.length > 0) {
      message += `🏙️ *${city}* (${places.length} мест):\n`;

      // ✅ ДОБАВЛЕНА СОРТИРОВКА ПО АЛФАВИТУ (места)
      const sortedPlaces = [...places].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

      sortedPlaces.slice(0, 5).forEach(place => {
        const category = place.category_emoji ? `${place.category_emoji} ` : '';
        message += `• ${category}${place.name}\n`;
      });

      if (places.length > 5) {
        message += `... и еще ${places.length - 5} мест\n`;
      }

      message += `\n`;
    }
  }

  await this.sendAdminMessage(chatId, message, { parse_mode: 'Markdown' });
}
async testMapUrlParsing(mapUrl) {
  console.log('\n🔬 ТЕСТИРОВАНИЕ ПАРСИНГА ССЫЛКИ');
  console.log(`URL: ${mapUrl.substring(0, 100)}...`);
  
  const decodedUrl = decodeURIComponent(mapUrl);
  
  const coordsMatches = [...decodedUrl.matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g)];
  console.log(`\n📍 Найдено наборов координат: ${coordsMatches.length}`);
  coordsMatches.forEach((match, index) => {
    console.log(`  ${index + 1}. lat=${match[1]}, lon=${match[2]}`);
  });
  
  const placeIdMatches = [...decodedUrl.matchAll(/!1s([^!]+)/g)];
  console.log(`\n🏷️ Найдено Place ID: ${placeIdMatches.length}`);
  placeIdMatches.forEach((match, index) => {
    console.log(`  ${index + 1}. ${match[1].substring(0, 50)}...`);
  });
  
  const nameMatches = [...decodedUrl.matchAll(/!2s([^!]+)/g)];
  console.log(`\n🏢 Найдено названий: ${nameMatches.length}`);
  nameMatches.forEach((match, index) => {
    const name = decodeURIComponent(match[1].replace(/\+/g, ' '));
    console.log(`  ${index + 1}. ${name}`);
  });
  
  console.log('\n🧪 Запускаем extractDataFromMapUrl:');
  return await this.extractDataFromMapUrl(mapUrl);
}
async sendPlacePhotos(chatId, photos) {
  if (!photos || photos.length === 0) {
    console.log('📭 Нет фото для отображения');
    return;
  }
  
  console.log(`📤 Пытаюсь отправить ${photos.length} фото...`);
  
  try {
    const validPhotos = photos
      .map(photo => {
        if (photo && typeof photo === 'object' && photo.url) {
          return photo;
        }
        if (photo && typeof photo === 'object' && photo.fileName) {
          const bucketName = 'help-tasc-progect.firebasestorage.app';
          const url = `https://storage.googleapis.com/${bucketName}/photos/${photo.fileName}`;
          return { ...photo, url: url };
        }
        if (typeof photo === 'string') {
          if (photo.startsWith('http')) {
            return { url: photo };
          }
          const bucketName = 'help-tasc-progect.firebasestorage.app';
          const url = `https://storage.googleapis.com/${bucketName}/photos/${photo}`;
          return { fileName: photo, url: url };
        }
        return null;
      })
      .filter(photo => photo !== null && photo.url);
    
    console.log(`✅ Нормализованные фото:`, validPhotos);
    
    if (validPhotos.length === 0) {
      console.log('⚠️ Нет валидных фото для отправки');
      return;
    }
    
    const photosToSend = validPhotos.slice(0, 5);
    
    for (let i = 0; i < photosToSend.length; i++) {
      const photo = photosToSend[i];
      try {
        console.log(`📸 Отправляю фото ${i + 1}/${photosToSend.length}:`, 
          photo.url.substring(0, 50) + '...');
        
        await this.sendPhotoAndTrack(chatId, photo.url, {});
        console.log(`✅ Фото ${i + 1} отправлено успешно`);
      } catch (photoError) {
        console.error(`❌ Ошибка отправки фото ${i + 1}:`, photoError.message);
        try {
          await this.sendAndTrack(chatId, `📎 Фото ${i + 1}: ${photo.url}`);
        } catch (linkError) {
          console.error(`❌ Не удалось отправить ссылку: ${linkError.message}`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    if (validPhotos.length > 5) {
      await this.sendAndTrack(chatId, `📷 Показано 5 из ${validPhotos.length} фото`);
    }
  } catch (error) {
    console.error('❌ Критическая ошибка при отправке фото:', error.message);
    await this.sendAndTrack(chatId, '⚠️ Не удалось загрузить фото');
  }
}

async handleEditingPlace(chatId, msg, state) {
  const text = msg.text;
  
  console.log(`🔍 [DEBUG handleEditingPlace] Текст: "${text}"`);
  console.log(`🔍 [DEBUG handleEditingPlace] Состояние:`, {
    step: state.step,
    editingField: state.editingField,
    placeId: state.placeId,
    city: state.city,
    placeData: state.placeData
  });
    // Проверяем, что ID полный
  if (state.placeId && state.placeId.length < 36) {
    console.error(`⚠️ [DEBUG] ID места слишком короткий: ${state.placeId} (длина: ${state.placeId.length})`);
    console.error(`⚠️ [DEBUG] Ожидаемая длина: 36 символов (UUID)`);
  }
  if (text === '/cancel' || text.toLowerCase() === 'отмена') {
    this.userStates.delete(chatId);
    await this.sendAdminMessage(chatId, '❌ Редактирование отменено.');
    await this.showAdminPanel(chatId);
    return;
  }
  
  // ПРОВЕРКА: если пользователь нажал "✅ Готово" в основном меню редактирования
  if (state.step === 'select_field' && text === '✅ Готово') {
    await this.sendAdminMessage(
      chatId,
      `✅ Редактирование места завершено!\n\n` +
      `🏛️ Место "${state.placeData.name}" успешно обновлено.`,
      { reply_markup: { remove_keyboard: true } }
    );
    
    this.userStates.delete(chatId);
    await this.showAdminPanel(chatId);
    return;
  }
  
  // ОБРАБОТКА ВВОДА НОВОГО ЗНАЧЕНИЯ
  if (state.step === 'enter_new_value') {
    const field = state.editingField;
    
    console.log(`🔍 [DEBUG] Редактируемое поле: "${field}"`);
    
    // ВАЖНО: Проверяем, что field существует и допустимо
    const validFields = ['name', 'address', 'working_hours', 'average_price', 
                         'description', 'website', 'phone', 'map_url', 'category_id'];
    
    if (!field || !validFields.includes(field)) {
      console.error(`❌ [DEBUG] Некорректное поле для редактирования: "${field}"`);
      await this.sendAdminMessage(
        chatId,
        `❌ Ошибка: поле "${field}" не может быть отредактировано.\n` +
        `Пожалуйста, начните редактирование заново.`
      );
      this.userStates.delete(chatId);
      await this.showAdminPanel(chatId);
      return;
    }
    
    let newValue = text.trim();
    
    console.log(`🔍 [DEBUG] Новое значение для поля "${field}": "${newValue}"`);
    
    // Валидация в зависимости от поля
    let isValid = true;
    let validationMessage = '';
    
    switch(field) {
      case 'name':
        if (newValue.length < 2) {
          isValid = false;
          validationMessage = 'Название должно содержать минимум 2 символа.';
        }
        break;
      case 'address':
        if (newValue.length < 5) {
          isValid = false;
          validationMessage = 'Адрес должен содержать минимум 5 символов.';
        }
        break;
      case 'description':
        if (newValue.length < 10) {
          isValid = false;
          validationMessage = 'Описание должно содержать минимум 10 символов.';
        }
        break;
      case 'website':
        if (newValue !== '-') {
          if (!newValue.includes('http://') && !newValue.includes('https://')) {
            newValue = `https://${newValue}`;
          }
        } else {
          newValue = '';
        }
        break;
      case 'phone':
      case 'working_hours':
      case 'average_price':
      case 'map_url':
        if (newValue === '-') {
          newValue = '';
        }
        break;
    }
    
    if (!isValid) {
      await this.sendAdminMessage(chatId, `❌ ${validationMessage}\n\nПожалуйста, введите значение заново:`);
      return;
    }
    
    // Сохраняем изменения
    const updateData = { [field]: newValue };
    
    console.log(`📝 [DEBUG] Обновляю поле "${field}" для города "${state.city}", место ID: ${state.placeId}`);
    console.log(`📝 [DEBUG] Данные для обновления:`, updateData);
    
    const result = await placeManager.updatePlace(state.city, state.placeId, updateData);
    
    if (result.success) {
      await this.sendAdminMessage(
        chatId,
        `✅ Поле "${field}" успешно обновлено!\n\n` +
        `Новое значение: ${newValue || '(пусто)'}\n\n` +
        `Что делать дальше?`,
        {
          reply_markup: {
            keyboard: [
              ['✏️ Продолжить редактирование', '✅ Завершить'],
              ['❌ Отмена']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
      
      // ОБНОВЛЯЕМ СОСТОЯНИЕ
      state.step = 'after_edit'; // Новый шаг
      state.placeData = result.place; // Обновляем данные места
      this.userStates.set(chatId, state);
    } else {
      await this.sendAdminMessage(chatId, `❌ Ошибка при обновлении: ${result.message}`);
      this.userStates.delete(chatId);
      await this.showAdminPanel(chatId);
    }
  } 
  // ОБРАБОТКА ПОСЛЕ РЕДАКТИРОВАНИЯ
  else if (state.step === 'after_edit') {
    if (text === '✏️ Продолжить редактирование') {
      // Используем cityKey для обратного вызова
      const cityKey = this.getCityKey(state.city);
      await this.handleEditPlaceSelect(chatId, cityKey, state.placeId, null);
    } else if (text === '✅ Завершить') {
      await this.sendAdminMessage(
        chatId,
        `✅ Редактирование места завершено!\n\n` +
        `🏛️ Место "${state.placeData.name}" успешно обновлено.`,
        { reply_markup: { remove_keyboard: true } }
      );
      
      this.userStates.delete(chatId);
      await this.showAdminPanel(chatId);
    }
  }
}
//*Управление категориями*
  async showCategoryManagement(chatId) {
    const categories = await categoryManager.getAllCategories();
    const customCategories = await categoryManager.getCustomCategories();
    
    let message = '📁 *Управление категориями*\n\n';
    message += `📊 *Статистика:*\n`;
    message += `├ Всего категорий: ${categories.length}\n`;
    message += `└ Пользовательских: ${customCategories.length}\n\n`;
    message += `*Доступные действия:*`;
    
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '📋 Список всех категорий', callback_data: 'admin_categories:list_all' },
          { text: '➕ Добавить категорию', callback_data: 'admin_categories:add' }
        ],
        [
          { text: '✏️ Редактировать категорию', callback_data: 'admin_categories:edit' },
          { text: '🗑️ Удалить категорию', callback_data: 'admin_categories:delete' }
        ],
        [
          { text: '🔙 Назад', callback_data: 'admin_action:back_to_panel' },
          { text: '🏠 Главное меню', callback_data: 'back:main_menu' }
        ]
      ]
    };
    
    await this.sendAdminMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
  }

async handleCategoriesManagement(chatId, action, param, messageId) {
  switch(action) {
    case 'list_all':
      await this.showAllCategories(chatId);
      break;
      
    case 'add':
      await this.startAddCategory(chatId);
      break;
      
    case 'edit':
      await this.startEditCategory(chatId); // Теперь работает!
      break;
      
    case 'delete':
      await this.startDeleteCategory(chatId);
      break;
  }
}

  async showAllCategories(chatId) {
    const categories = await categoryManager.getAllCategories();
    const customCategories = await categoryManager.getCustomCategories();
    
    let message = '📁 *Список всех категорий:*\n\n';
    
    message += '*Стандартные категории:*\n';
    categories.filter(cat => !cat.isCustom).forEach((cat, index) => {
      message += `${index + 1}. ${cat.emoji} ${cat.name}\n`;
    });
    
    if (customCategories.length > 0) {
      message += `\n*Пользовательские категории:*\n`;
      customCategories.forEach((cat, index) => {
        message += `${index + 1}. ${cat.emoji} ${cat.name}\n`;
      });
    }
    
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '➕ Добавить категорию', callback_data: 'admin_categories:add' },
          { text: '🗑️ Удалить категорию', callback_data: 'admin_categories:delete' }
        ],
        [
          { text: '🔙 Назад', callback_data: 'admin_action:manage_categories' },
          { text: '🏠 Главное меню', callback_data: 'back:main_menu' }
        ]
      ]
    };
    
    await this.sendAdminMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
  }

  async startAddCategory(chatId) {
    await this.sendAdminMessage(
      chatId,
      '📁 *Добавление новой категории*\n\n' +
      'Введите название новой категории:',
      { parse_mode: 'Markdown' }
    );
    
    this.userStates.set(chatId, {
      action: 'adding_category',
      step: 'enter_name',
      city: null  // ✅ Явно указываем, что город не определен
    });
  }

async startEditCategory(chatId) {
  const customCategories = await categoryManager.getCustomCategories();
  
  if (customCategories.length === 0) {
    await this.sendAdminMessage(
      chatId,
      '📭 Нет пользовательских категорий для редактирования.\n' +
      'Стандартные категории редактировать нельзя.'
    );
    return;
  }
  
  let message = '✏️ *Редактирование категории*\n\n';
  message += 'Выберите категорию для редактирования:';
  
  const inlineKeyboard = {
    inline_keyboard: []
  };
  
  customCategories.forEach(cat => {
    inlineKeyboard.inline_keyboard.push([
      {
        text: `${cat.emoji} ${this.cleanButtonText(cat.name)}`,
        callback_data: `edit_category_select:${cat.id}`
      }
    ]);
  });
  
  inlineKeyboard.inline_keyboard.push([
    { text: '🔙 Назад', callback_data: 'admin_action:manage_categories' }
  ]);
  
  await this.sendAdminMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}
  async startDeleteCategory(chatId) {
    const customCategories = await categoryManager.getCustomCategories();
    
    if (customCategories.length === 0) {
      await this.sendAdminMessage(
        chatId,
        '📭 Нет пользовательских категорий для удаления.\n' +
        'Стандартные категории удалить нельзя.'
      );
      return;
    }
    
    let message = '🗑️ *Удаление категории*\n\n';
    message += '*Предупреждение:* При удалении категории все места в этой категории будут переведены в категорию "Другое".\n\n';
    message += 'Выберите категорию для удаления:';
    
    const inlineKeyboard = {
      inline_keyboard: []
    };
    
    for (let i = 0; i < customCategories.length; i += 2) {
      const row = customCategories.slice(i, i + 2).map(cat => ({
        text: `${cat.emoji} ${this.cleanButtonText(cat.name)}`,
        callback_data: `delete_category_confirm:${cat.id}:show`
      }));
      inlineKeyboard.inline_keyboard.push(row);
    }
    
    inlineKeyboard.inline_keyboard.push([
      { text: '🔙 Отмена', callback_data: 'delete_category_cancel' }
    ]);
    
    await this.sendAdminMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
  }

  async handleDeleteCategoryConfirm(chatId, categoryId, action, messageId) {
    const category = await categoryManager.getCategoryById(categoryId);
    
    if (!category) {
      await this.sendAdminMessage(chatId, '❌ Категория не найдена');
      return;
    }
    
    if (action === 'show') {
      // Проверяем, используется ли категория в местах
      const cities = await cityManager.getAllCities();
      let placesCount = 0;
      
      for (const city of cities) {
        const places = await placeManager.getPlacesByCategory(city, categoryId);
        placesCount += places.length;
      }
      
      let message = `🗑️ *Удаление категории: ${category.emoji} ${category.name}*\n\n`;
      
      if (placesCount > 0) {
        message += `⚠️ *Внимание:* В этой категории находится ${placesCount} мест.\n`;
        message += `При удалении все места будут переведены в категорию "Другое".\n\n`;
      }
      
      message += `Вы уверены, что хотите удалить эту категорию?`;
      
      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '✅ Да, удалить', callback_data: `delete_category_confirm:${categoryId}:confirm` },
            { text: '❌ Нет, отмена', callback_data: 'delete_category_cancel' }
          ]
        ]
      };
      
      await this.sendAdminMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard
      });
      
    } else if (action === 'confirm') {
      // Удаляем категорию
      const result = await categoryManager.deleteCategory(categoryId);
      
      if (result.success) {
        await this.sendAdminMessage(
          chatId,
          `✅ Категория "${category.emoji} ${category.name}" успешно удалена!\n` +
          `${result.message || ''}`,
          { parse_mode: 'Markdown' }
        );
        
        // Возвращаемся к управлению категориями
        setTimeout(async () => {
          await this.showCategoryManagement(chatId);
        }, 1000);
      } else {
        await this.sendAdminMessage(
          chatId,
          `❌ Ошибка при удалении категории: ${result.message}`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  }

  async handleSearch(chatId, query) {
    if (!query || query.trim().length < 2) {
      await this.sendAndTrack(chatId, '❌ Введите минимум 2 символа для поиска.');
      return;
    }
    
    const cities = await cityManager.getAllCities();
    let results = [];
    
    const foundCities = cities.filter(city => 
      city.toLowerCase().includes(query.toLowerCase())
    );
    
    for (const city of cities) {
      const cityResults = await placeManager.searchPlaces(city, query);
      if (cityResults.length > 0) {
        results.push({
          city: city,
          places: cityResults
        });
      }
    }
    
    let message = `🔍 *Результаты поиска по запросу: "${query}"*\n\n`;
    
    if (foundCities.length > 0) {
      message += `🏙️ *Найденные города:*\n`;
      foundCities.forEach(city => {
        message += `• ${city}\n`;
      });
      message += `\n`;
    }
    
    if (results.length > 0) {
      message += `📍 *Найденные места:*\n`;
      results.forEach(result => {
        message += `\n*${result.city}:*\n`;
        result.places.forEach(place => {
          message += `• ${place.name}\n`;
        });
      });
    }
    
    if (foundCities.length === 0 && results.length === 0) {
      message += '😔 Ничего не найдено. Попробуйте другой запрос.';
    }
    
    this.userStates.delete(chatId);
    await this.sendAndTrack(chatId, message, { parse_mode: 'Markdown' });
  }

async showNews(chatId, isAdmin = false) {
  const news = [
    {
      date: '16.01.2026',
      title: 'Мы начинаем раборту !!',
      description: 'Рады сообщить, что наш бот по гастрономическим путешествиям официально запущен и готов помочь вам открыть лучшие места в вашем городе! Большое спасибо за терперние мы развиваем наш проект для вас.'
    }
  ];
  
  let message = '📰 *Последние новости:*\n\n';
  
  news.forEach((item, index) => {
    message += `*${item.date}* - ${item.title}\n`;
    message += `${item.description}\n\n`;
  });
  
  await this.sendAndTrack(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: this.getKeyboardWithMainMenu(isAdmin)
  });
}

async showMediaLinks(chatId, isAdmin = false) {
  const media = [
    { name: 'Instagram', icon: '📸', url: '' },
    { name: 'Telegram-канал', icon: '📢', url: '' },
    { name: 'YouTube', icon: '🎥', url: '' }
  ];
  
  let message = '📱 *Наши медиа:*\n\n';
  
  media.forEach(item => {
    message += `${item.icon} *${item.name}:* [ссылка](${item.url})\n`;
  });
  
  await this.sendAndTrack(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: this.getKeyboardWithMainMenu(isAdmin)
  });
}

async showAdminStats(chatId) {
  const cities = await cityManager.getAllCities();
  const ads = await this.adsManager.getAllAds();
  
  let totalPlaces = 0;
  const statsByCity = [];
  
  for (const city of cities) {
    const cityData = await cityManager.getCityData(city);
    const placeCount = cityData.places ? cityData.places.length : 0;
    totalPlaces += placeCount;
    statsByCity.push({ city, places: placeCount });
  }
  
  const totalAdViews = ads.reduce((sum, ad) => sum + (ad.views || 0), 0);
  
  let message = '📈 *Статистика системы:*\n\n';
  message += `🏙️ Городов: ${cities.length}\n`;
  message += `📍 Всего мест: ${totalPlaces}\n\n`;
  
  if (statsByCity.length > 0) {
    message += `*Статистика по городам:*\n`;
    statsByCity.forEach(stat => {
      message += `• ${stat.city}: ${stat.places} мест\n`;
    });
  }
  
  // ✅ ДОБАВЬТЕ СТАТИСТИКУ ПО РЕКЛАМЕ
  if (ads.length > 0) {
    message += `\n📢 *Статистика рекламы:*\n`;
    message += `• Всего объявлений: ${ads.length}\n`;
    message += `• Всего показов: ${totalAdViews}\n`;
    
    if (totalAdViews > 0) {
      const avgViews = Math.round(totalAdViews / ads.length);
      message += `• Среднее показов на объявление: ${avgViews}\n`;
    }
  }
  
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '🔄 Синхронизировать Firebase', callback_data: 'admin_action:sync_firebase' }
      ],
      [
        { text: '🔙 Назад', callback_data: 'admin_action:back_to_panel' },
        { text: '🏠 Главное меню', callback_data: 'back:main_menu' }
      ]
    ]
  };
  
  await this.sendAdminMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: inlineKeyboard });
}

// ✅ НОВЫЙ МЕТОД для синхронизации данных в Firebase
async syncDataToFirebase(chatId) {
  if (!this.firebaseDB || !this.firebaseDB.initialized) {
    await this.sendAdminMessage(
      chatId,
      '❌ Firebase Database не инициализирована.'
    );
    return;
  }

  try {
    const statusMsg = await this.sendAdminMessage(chatId, '⏳ Начинаю синхронизацию...');

    // Синхронизация категорий
    const categories = await categoryManager.getAllCategories();
    let syncStatus = `🔄 Синхронизация:\n\n`;
    
    const catResult = await this.firebaseDB.syncCategoriesToFirebase(categories);
    syncStatus += `${catResult.success ? '✅' : '❌'} Категории: ${categories.length}\n`;

    // Синхронизация городов
    const cities = await cityManager.getAllCities();
    const cityResult = await this.firebaseDB.syncCitiesToFirebase(cities);
    syncStatus += `${cityResult.success ? '✅' : '❌'} Города: ${cities.length}\n`;

    // Синхронизация мест
    const places = await placeManager.getAllPlaces();
    const placeResult = await this.firebaseDB.syncPlacesToFirebase(places);
    syncStatus += `${placeResult.success ? '✅' : '❌'} Места: ${places.length}\n`;

    // Итоговое сообщение
    if (catResult.success && cityResult.success && placeResult.success) {
      syncStatus += '\n✅ Синхронизация успешно завершена!';
    } else {
      syncStatus += '\n⚠️  Синхронизация завершена с ошибками';
    }

    await this.sendAdminMessage(chatId, syncStatus);

  } catch (error) {
    console.error('❌ Ошибка при синхронизации:', error.message);
    await this.sendAdminMessage(
      chatId,
      `❌ Ошибка при синхронизации: ${error.message}`
    );
  }
}

async handleBackAction(chatId, target, isAdmin) {
  switch(target) {
    case 'main_menu':
      // Сбрасываем админ-сессию при возврате в главное меню
      this.adminSessions.delete(chatId);
      await this.showMainMenu(chatId, 'Главное меню:', isAdmin);
      break;
    case 'city':
      const state = this.userStates.get(chatId);
      if (state && state.selectedCity) {
        // Используем ключ города для callback
        const cityKey = this.getCityKey(state.selectedCity);
        await this.handleCitySelection(chatId, cityKey, isAdmin);
      } else {
        await this.showCitySelection(chatId, isAdmin);
      }
      break;
  }
}

  async getTotalPlacesCount() {
    const cities = await cityManager.getAllCities();
    let total = 0;
    
    for (const city of cities) {
      try {
        const cityData = await cityManager.getCityData(city);
        if (cityData && cityData.places) {
          total += cityData.places.length;
        }
      } catch (error) {
        console.warn(`⚠️ Ошибка при подсчёте мест города "${city}":`, error.message);
      }
    }
    
    return total;
  }


// 2. Добавьте метод для показа вариантов проблем
async showIssueOptions(chatId, cityKey, placeId) {
  const cityName = await this.getCityNameFromKey(cityKey);
  const place = await placeManager.getPlaceById(cityName, placeId);
  const userId = this.userStates.get(chatId)?.userId || chatId;
  const isAdmin = this.isUserAdmin(userId);
  
  if (!place) {
    await this.sendAndTrack(chatId, '❌ Место не найдено.', {
      reply_markup: this.getKeyboardWithMainMenu(isAdmin)
    });
    return;
  }
  
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '🚫 Не работает больше', callback_data: `issue:${cityKey}:${placeId}:closed` }
      ],
      [
        { text: '⏰ Изменилось расписание', callback_data: `issue:${cityKey}:${placeId}:schedule` }
      ],
      [
        { text: '📍 Неправильный адрес', callback_data: `issue:${cityKey}:${placeId}:address` }
      ],
      [
        { text: '🔗 Не работают ссылки', callback_data: `issue:${cityKey}:${placeId}:links` }
      ],
      [
        { text: '📞 Неправильный телефон', callback_data: `issue:${cityKey}:${placeId}:phone` }
      ],
      [
        { text: '🔙 Назад к месту', callback_data: `show_place:${cityKey}:${placeId}` }
      ]
    ]
  };
  
  await this.sendAndTrack(
    chatId,
    `⚠️ *Сообщить о проблеме: ${place.name}*\n\n` +
    `Выберите тип проблемы:`,
    {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    }
  );
  

}

// 3. Добавьте метод для обработки сообщения о проблеме
async handleIssueReport(chatId, cityKey, placeId, issueType) {
  const cityName = await this.getCityNameFromKey(cityKey);
  const place = await placeManager.getPlaceById(cityName, placeId);
  
  if (!place) {
    await this.sendAndTrack(chatId, '❌ Место не найдено.');
    return;
  }
  
  const issueLabels = {
    closed: '🚫 Не работает больше',
    schedule: '⏰ Изменилось расписание',
    address: '📍 Неправильный адрес',
    links: '🔗 Не работают ссылки',
    phone: '📞 Неправильный телефон'
  };
  
  const issueFieldMap = {
    closed: 'description',
    schedule: 'working_hours',
    address: 'address',
    links: 'website',
    phone: 'phone'
  };
  
  // Отправляем подтверждение пользователю
  await this.sendAndTrack(
    chatId,
    `✅ Спасибо за сообщение!\n\n` +
    `Проблема "${issueLabels[issueType]}" для места "${place.name}" отправлена администраторам.\n\n` +
    `Мы скоро всё исправим! 🔧`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { 
              text: '🔙 К месту', 
              callback_data: `show_place:${cityKey}:${placeId}` 
            },
            { 
              text: '🏠 Главное меню', 
              callback_data: 'back:main_menu' 
            }
          ]
        ]
      }
    }
  );
  
  // Отправляем уведомления администраторам
  await this.notifyAdminsAboutIssue(cityName, place, issueType, issueFieldMap[issueType]);
}

// 4. Добавьте метод для уведомления администраторов
async notifyAdminsAboutIssue(cityName, place, issueType, fieldToEdit) {
  const issueLabels = {
    closed: '🚫 Не работает больше',
    schedule: '⏰ Изменилось расписание',
    address: '📍 Неправильный адрес',
    links: '🔗 Не работают ссылки',
    phone: '📞 Неправильный телефон'
  };
  
  const category = await categoryManager.getCategoryById(place.category_id);
  const cityKey = this.getCityKey(cityName);
  
  let message = `⚠️ *СООБЩЕНИЕ О ПРОБЛЕМЕ*\n\n`;
  message += `🏛️ *Место:* ${place.name}\n`;
  message += `🏙️ *Город:* ${cityName}\n`;
  message += `📁 *Категория:* ${category.emoji} ${category.name}\n`;
  message += `🆔 *ID:* \`${place.id}\`\n\n`;
  message += `❗ *Проблема:* ${issueLabels[issueType]}\n\n`;
  
  // Показываем текущее значение поля

  
  if (fieldToEdit && place[fieldToEdit]) {
    message += `📋 *Текущее значение (${this.fieldLabels[fieldToEdit]}):*\n`;
    message += `${place[fieldToEdit]}\n\n`;
  }
  
  message += `⏰ *Время сообщения:* ${new Date().toLocaleString('ru-RU')}`;
  
  // Создаем короткий ID для callback_data
  const shortPlaceId = place.id.substring(0, 8);
  
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { 
          text: `✏️ Исправить ${this.fieldLabels[fieldToEdit]}`, 
          callback_data: `e_f:${cityKey}:${shortPlaceId}:${this.getShortFieldName(fieldToEdit)}` 
        }
      ],
      [
        { 
          text: '📋 Все поля места', 
          callback_data: `edit_place_select:${cityKey}:${place.id}` 
        }
      ],
      [
        { 
          text: '🗑️ Удалить место', 
          callback_data: `e_f:${cityKey}:${shortPlaceId}:del` 
        }
      ]
    ]
  };
  
  // Отправляем всем администраторам
  for (const adminId of this.adminIds) {
    try {
      await this.bot.sendMessage(adminId, message, {
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard
      });
      console.log(`✅ Уведомление отправлено админу ${adminId}`);
    } catch (error) {
      console.error(`❌ Ошибка отправки админу ${adminId}:`, error.message);
    }
  }
}

// 5. Вспомогательный метод для сокращения имен полей
getShortFieldName(fieldName) {
  const fieldMap = {
    name: 'n',
    address: 'a',
    working_hours: 't',
    average_price: 'p',
    description: 'd',
    website: 'w',
    phone: 'ph',
    map_url: 'm',
    category_id: 'c',
    latitude: 'lat',
    longitude: 'lon',
    google_place_id: 'gpid'
  };
  
  return fieldMap[fieldName] || fieldName;
}
async showAdAfterPlace(chatId, userId, cityKey, placeId) {
  try {
    const ad = await this.adsManager.getAdForUser(userId);
    
    if (!ad) {
      return; // Нет рекламы - не показываем
    }
    
    // Увеличиваем счетчик просмотров
    await this.adsManager.incrementViews(ad.id);
    
    let adMessage = `📢 *Реклама*\n\n${ad.text}`;
    
    const inlineKeyboard = {
      inline_keyboard: []
    };
    
    if (ad.url) {
      inlineKeyboard.inline_keyboard.push([
        { text: '🔗 Перейти', url: ad.url }
      ]);
    }
    

    
    await this.sendAndTrack(chatId, adMessage, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
    
    console.log(`📢 Показана реклама ${ad.id} пользователю ${userId}`);
    
  } catch (error) {
    console.error('❌ Ошибка показа рекламы:', error);
  }
}

async showAdsManagement(chatId) {
  const ads = await this.adsManager.getAllAds();
  
  let message = '📢 *Управление рекламой*\n\n';
  
  if (ads.length === 0) {
    message += '📭 Нет активных объявлений.\n\n';
  } else {
    message += `📊 *Статистика:*\n`;
    message += `├ Всего объявлений: ${ads.length}\n`;
    
    const totalViews = ads.reduce((sum, ad) => sum + (ad.views || 0), 0);
    message += `└ Всего показов: ${totalViews}\n\n`;
  }
  
  message += `*Доступные действия:*`;
  
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '📋 Список всех объявлений', callback_data: 'admin_ads:list' }
      ],
      [
        { text: '➕ Добавить объявление', callback_data: 'admin_ads:add' }
      ]
    ]
  };
  
  if (ads.length > 0) {
    inlineKeyboard.inline_keyboard.push([
      { text: '✏️ Редактировать объявление', callback_data: 'admin_ads:edit' },
      { text: '🗑️ Удалить объявление', callback_data: 'admin_ads:delete' }
    ]);
  }
  
  inlineKeyboard.inline_keyboard.push([
    { text: '🔙 Назад', callback_data: 'admin_action:back_to_panel' },
    { text: '🏠 Главное меню', callback_data: 'back:main_menu' }
  ]);
  
  await this.sendAdminMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}

async showAdsList(chatId) {
  const ads = await this.adsManager.getAllAds();
  
  if (ads.length === 0) {
    await this.sendAdminMessage(chatId, '📭 Нет объявлений для показа.');
    return;
  }
  
  let message = '📋 *Список всех объявлений:*\n\n';
  
  ads.forEach((ad, index) => {
    message += `*${index + 1}. Объявление #${ad.id}*\n`;
    message += `📝 Текст: ${ad.text.substring(0, 50)}${ad.text.length > 50 ? '...' : ''}\n`;
    message += `🔗 URL: ${ad.url || 'не указан'}\n`;
    message += `👁 Просмотров: ${ad.views || 0}\n`;
    message += `📅 Создано: ${new Date(ad.created_at).toLocaleDateString('ru-RU')}\n\n`;
  });
  
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '➕ Добавить объявление', callback_data: 'admin_ads:add' },
        { text: '🗑️ Удалить объявление', callback_data: 'admin_ads:delete' }
      ],
      [
        { text: '🔙 Назад', callback_data: 'admin_action:manage_ads' },
        { text: '🏠 Главное меню', callback_data: 'back:main_menu' }
      ]
    ]
  };
  
  await this.sendAdminMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}

async startAddAd(chatId) {
  await this.sendAdminMessage(
    chatId,
    '📢 *Добавление нового объявления*\n\n' +
    'Шаг 1 из 2\n\n' +
    'Введите текст рекламного объявления:\n\n' +
    '_Пример: "Лучшие суши в городе! Скидка 20% по промокоду BOT20"_',
    { parse_mode: 'Markdown' }
  );
  
  this.userStates.set(chatId, {
    action: 'adding_ad',
    step: 'enter_text'
  });
}

async startEditAd(chatId) {
  const ads = await this.adsManager.getAllAds();
  
  if (ads.length === 0) {
    await this.sendAdminMessage(chatId, '📭 Нет объявлений для редактирования.');
    return;
  }
  
  let message = '✏️ *Редактирование объявления*\n\n';
  message += 'Выберите объявление для редактирования:';
  
  const inlineKeyboard = {
    inline_keyboard: []
  };
  
  ads.forEach((ad, index) => {
    const shortText = ad.text.substring(0, 40);
    inlineKeyboard.inline_keyboard.push([
      {
        text: `${index + 1}. ${shortText}... (👁${ad.views || 0})`,
        callback_data: `edit_ad_select:${ad.id}`
      }
    ]);
  });
  
  inlineKeyboard.inline_keyboard.push([
    { text: '🔙 Назад', callback_data: 'admin_action:manage_ads' }
  ]);
  
  await this.sendAdminMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}

async startDeleteAd(chatId) {
  const ads = await this.adsManager.getAllAds();
  
  if (ads.length === 0) {
    await this.sendAdminMessage(chatId, '📭 Нет объявлений для удаления.');
    return;
  }
  
  let message = '🗑️ *Удаление объявления*\n\n';
  message += 'Выберите объявление для удаления:';
  
  const inlineKeyboard = {
    inline_keyboard: []
  };
  
  ads.forEach((ad, index) => {
    const shortText = ad.text.substring(0, 40);
    inlineKeyboard.inline_keyboard.push([
      {
        text: `${index + 1}. ${shortText}...`,
        callback_data: `delete_ad_confirm:${ad.id}`
      }
    ]);
  });
  
  inlineKeyboard.inline_keyboard.push([
    { text: '🔙 Отмена', callback_data: 'admin_action:manage_ads' }
  ]);
  
  await this.sendAdminMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}

async handleEditAdSelect(chatId, adId) {
  const ad = await this.adsManager.getAdById(adId);
  
  if (!ad) {
    await this.sendAdminMessage(chatId, '❌ Объявление не найдено.');
    return;
  }
  
  this.userStates.set(chatId, {
    action: 'editing_ad',
    step: 'select_field',
    adId: adId,
    adData: ad
  });
  
  let message = `✏️ *Редактирование объявления*\n\n`;
  message += `📝 *Текст:* ${ad.text}\n`;
  message += `🔗 *URL:* ${ad.url || 'не указан'}\n`;
  message += `👁 *Просмотров:* ${ad.views || 0}\n\n`;
  message += `Выберите поле для редактирования:`;
  
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '📝 Изменить текст', callback_data: `edit_ad_field:${adId}:text` },
        { text: '🔗 Изменить URL', callback_data: `edit_ad_field:${adId}:url` }
      ],
      [
        { text: '🔙 Назад', callback_data: 'admin_ads:edit' },
        { text: '❌ Отмена', callback_data: 'admin_action:manage_ads' }
      ]
    ]
  };
  
  await this.sendAdminMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}

async handleDeleteAdConfirm(chatId, adId) {
  const ad = await this.adsManager.getAdById(adId);
  
  if (!ad) {
    await this.sendAdminMessage(chatId, '❌ Объявление не найдено.');
    return;
  }
  
  let message = `🗑️ *Удаление объявления*\n\n`;
  message += `📝 Текст: ${ad.text}\n`;
  message += `🔗 URL: ${ad.url || 'не указан'}\n`;
  message += `👁 Просмотров: ${ad.views || 0}\n\n`;
  message += `Вы уверены, что хотите удалить это объявление?`;
  
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '✅ Да, удалить', callback_data: `delete_ad_execute:${adId}` },
        { text: '❌ Нет, отмена', callback_data: 'admin_action:manage_ads' }
      ]
    ]
  };
  
  await this.sendAdminMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}

async handleAddingAd(chatId, msg, state) {
  const text = msg.text;
  
  if (text === '/cancel' || text.toLowerCase() === 'отмена') {
    this.userStates.delete(chatId);
    await this.sendAdminMessage(chatId, '❌ Добавление объявления отменено.');
    await this.showAdsManagement(chatId);
    return;
  }
  
  switch(state.step) {
    case 'enter_text':
      if (!text || text.trim().length < 10) {
        await this.sendAdminMessage(
          chatId,
          '❌ Текст объявления должен содержать минимум 10 символов.\n' +
          'Пожалуйста, введите текст заново:'
        );
        return;
      }
      
      state.adText = text.trim();
      state.step = 'enter_url';
      this.userStates.set(chatId, state);
      
      await this.sendAdminMessage(
        chatId,
        `✅ Текст сохранен.\n\n` +
        `Шаг 2 из 2\n\n` +
        `Введите URL для перехода (ссылку на сайт рекламодателя).\n` +
        `Для пропуска отправьте "-":\n\n` +
        `_Пример: https://example.com или https://t.me/yourchannel_`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'enter_url':
      let url = null;
      
      if (text !== '-') {
        url = text.trim();
        
        // Добавляем https:// если нет
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = `https://${url}`;
        }
      }
      
      const result = await this.adsManager.addAd({
        text: state.adText,
        url: url
      });
      
      if (result.success) {
        await this.sendAdminMessage(
          chatId,
          `✅ ${result.message}\n\n` +
          `📝 Текст: ${result.ad.text}\n` +
          `🔗 URL: ${result.ad.url || 'не указан'}\n\n` +
          `Объявление будет показываться пользователям после просмотра мест.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await this.sendAdminMessage(chatId, `❌ ${result.message}`);
      }
      
      this.userStates.delete(chatId);
      
      setTimeout(async () => {
        await this.showAdsManagement(chatId);
      }, 1000);
      break;
  }
}

async handleEditingAd(chatId, msg, state) {
  const text = msg.text;
  
  if (text === '/cancel' || text.toLowerCase() === 'отмена') {
    this.userStates.delete(chatId);
    await this.sendAdminMessage(chatId, '❌ Редактирование отменено.');
    await this.showAdsManagement(chatId);
    return;
  }
  
  if (state.step === 'enter_new_value') {
    const field = state.editingField;
    
    let updateData = {};
    
    if (field === 'text') {
      if (!text || text.trim().length < 10) {
        await this.sendAdminMessage(
          chatId,
          '❌ Текст объявления должен содержать минимум 10 символов.\n' +
          'Пожалуйста, введите текст заново:'
        );
        return;
      }
      updateData.text = text.trim();
    } else if (field === 'url') {
      if (text === '-') {
        updateData.url = null;
      } else {
        let url = text.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = `https://${url}`;
        }
        updateData.url = url;
      }
    }
    
    const result = await this.adsManager.updateAd(state.adId, updateData);
    
    if (result.success) {
      await this.sendAdminMessage(
        chatId,
        `✅ Объявление успешно обновлено!\n\n` +
        `📝 Текст: ${result.ad.text}\n` +
        `🔗 URL: ${result.ad.url || 'не указан'}`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await this.sendAdminMessage(chatId, `❌ ${result.message}`);
    }
    
    this.userStates.delete(chatId);
    
    setTimeout(async () => {
      await this.showAdsManagement(chatId);
    }, 1000);
  }
}

async handleUserState(chatId, userId, msg, state, isAdmin) {
  const text = msg.text;

  // Проверяем, что состояние валидно
  if (!state || !state.action) {
    this.userStates.delete(chatId);
    await this.sendAdminMessage(chatId, '❌ Сессия устарела. Начните заново.');
    await this.showMainMenu(chatId, 'Главное меню:', isAdmin);
    return;
  }

  if (text === '/cancel' || text.toLowerCase() === 'отмена') {
    this.userStates.delete(chatId);
    this.userPhotos.delete(chatId);
    await this.sendAdminMessage(chatId, '❌ Действие отменено.');
    await this.showAdminPanel(chatId);
    return;
  }

  if (text === '/skip') {
    // Для пропуска фото при добавлении города
    if (state.action === 'adding_city' && state.step === 'add_photo') {
      state.step = 'finish';
      this.userStates.set(chatId, state);
      await this.finishAddingCity(chatId, state);
      return;
    }
  }

  if (state.step === 'create_category_emoji') {
    await this.handleCreateCategoryEmoji(chatId, text, state);
    return;
  }

  if (state.action === 'editing_place') {
    await this.handleEditingPlace(chatId, msg, state);
    return;
  }

  if (state.action === 'editing_category') {
    await this.handleEditingCategory(chatId, msg, state);
    return;
  }

  if (state.action === 'adding_category') {
    await this.handleAddingCategory(chatId, msg, state);
    return;
  }

  if (state.action === 'editing_social_field') {
    await this.handleEditingSocialField(chatId, msg, state);
    return;
  }

  if (state.action === 'editing_social_item') {
    await this.handleEditingSocialItem(chatId, msg, state);
    return;
  }

  if (state.action === 'adding_ad') {
    await this.handleAddingAd(chatId, msg, state);
    return;
  }

  if (state.action === 'editing_ad') {
    await this.handleEditingAd(chatId, msg, state);
    return;
  }

  switch (state.action) {
    case 'adding_city':
      await this.handleAddingCity(chatId, msg, state);
      break;

    case 'adding_place':
      await this.handleAddingPlace(chatId, msg, state);
      break;

    case 'search':
      await this.handleSearch(chatId, text);
      break;

    default:
      console.warn(`⚠️ Неизвестное действие в состоянии: ${state.action}`);
      this.userStates.delete(chatId);
      await this.sendAdminMessage(chatId, '❌ Неизвестная команда. Попробуйте снова.');
      await this.showMainMenu(chatId, 'Главное меню:', isAdmin);
  }
}

}

module.exports = CityGuideBot;
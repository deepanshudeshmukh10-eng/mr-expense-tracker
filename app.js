const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxw9iJvMfMwQ9SGeUDvd5Vr6u9AiXxTBrf7bfD80ZLIn-c2ZiEtc7YnqoyseOTHmDTbAw/exec";

let existingToursList = [];
let selectedTravelMode = "Train"; // Default active mode
let activeTourName = "";

window.addEventListener('DOMContentLoaded', () => {
  // Set default date to Today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('expenseDate').value = today;

  // Restore Theme
  const savedTheme = localStorage.getItem('appTheme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  loadTours();

  window.addEventListener('online', syncOfflineExpenses);
  if (navigator.onLine) {
    syncOfflineExpenses();
  }
});

// --- THEME SWITCHER ---
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('appTheme', newTheme);
}

// --- NAVIGATION & PAGE LOGIC ---
function goToPage1() {
  document.getElementById('page2').classList.remove('active');
  document.getElementById('page1').classList.add('active');
}

function proceedToPage2() {
  const selectVal = document.getElementById('tourSelect').value;
  const inputVal = document.getElementById('newTourInput').value.trim();
  const errorSpan = document.getElementById('tourError');

  errorSpan.textContent = "";

  if (inputVal !== "") {
    // Check uniqueness (case-insensitive)
    const exists = existingToursList.some(t => t.toLowerCase() === inputVal.toLowerCase());
    if (exists) {
      errorSpan.textContent = "A tour with this name already exists. Select it from the dropdown above!";
      return;
    }
    activeTourName = inputVal;
  } else if (selectVal !== "") {
    activeTourName = selectVal;
  } else {
    errorSpan.textContent = "Please select an existing tour or enter a new tour name.";
    return;
  }

  // Update Page 2 Heading
  document.getElementById('currentTourHeading').textContent = activeTourName;

  // Switch pages
  document.getElementById('page1').classList.remove('active');
  document.getElementById('page2').classList.add('active');
}

function handleSelectTour() {
  if (document.getElementById('tourSelect').value !== "") {
    document.getElementById('newTourInput').value = "";
    document.getElementById('tourError').textContent = "";
  }
}

function handleInputTour() {
  if (document.getElementById('newTourInput').value.trim() !== "") {
    document.getElementById('tourSelect').value = "";
    document.getElementById('tourError').textContent = "";
  }
}

// --- TRAVEL MODE BUTTON SWITCH ---
function selectTravelMode(btnElement) {
  const buttons = document.querySelectorAll('#travelToggleGroup .toggle-btn');
  buttons.forEach(b => b.classList.remove('active'));
  
  btnElement.classList.add('active');
  selectedTravelMode = btnElement.getAttribute('data-mode');
}

// --- FETCH TOURS ---
async function loadTours() {
  if (!navigator.onLine) return;
  
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getTours`);
    const data = await response.json();

    if (data.status === 'success') {
      existingToursList = data.tours || [];
      const tourSelect = document.getElementById('tourSelect');
      tourSelect.innerHTML = '<option value="">-- Select Existing Tour --</option>';
      
      existingToursList.forEach(tour => {
        const option = document.createElement('option');
        option.value = tour;
        option.textContent = tour;
        tourSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.log("Offline mode: Skipping tour fetch.");
  }
}

function formatDateToDDMMYY(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year.slice(-2)}`;
}

// --- SAVE EXPENSE FUNCTION ---
async function submitExpense() {
  const submitBtn = document.getElementById('submitBtn');
  const rawDate = document.getElementById('expenseDate').value;

  if (!rawDate) {
    setStatus("Please select a date.", "error");
    return;
  }

  const payload = {
    tourName: activeTourName,
    date: formatDateToDDMMYY(rawDate),
    breakfast: document.getElementById('bfAmount').value,
    lunch: document.getElementById('lunchAmount').value,
    dinner: document.getElementById('dinnerAmount').value,
    accommodation: document.getElementById('stayAmount').value,
    travelMode: selectedTravelMode,
    travelAmount: document.getElementById('travelAmount').value
  };

  if (!navigator.onLine) {
    saveToLocalQueue(payload);
    setStatus("Offline! Expense saved on phone. Will sync automatically when connected.", "info");
    resetFormFields();
    return;
  }

  submitBtn.disabled = true;
  setStatus("Saving expense...", "info");

  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (result.status === 'success') {
      setStatus(result.message, "success");
      resetFormFields();
      loadTours();
    } else {
      setStatus(`Error: ${result.message}`, "error");
    }
  } catch (error) {
    saveToLocalQueue(payload);
    setStatus("Connection failed. Saved offline for auto-sync!", "info");
    resetFormFields();
  } finally {
    submitBtn.disabled = false;
  }
}

// --- OFFLINE QUEUE MANAGEMENT ---
function getLocalQueue() {
  const queue = localStorage.getItem('offlineExpenses');
  return queue ? JSON.parse(queue) : [];
}

function saveToLocalQueue(payload) {
  const queue = getLocalQueue();
  queue.push(payload);
  localStorage.setItem('offlineExpenses', JSON.stringify(queue));
}

async function syncOfflineExpenses() {
  const queue = getLocalQueue();
  if (queue.length === 0) return;

  setStatus(`Internet restored! Syncing ${queue.length} offline entry/entries...`, "info");

  const remainingQueue = [];

  for (const payload of queue) {
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.status !== 'success') {
        remainingQueue.push(payload);
      }
    } catch (err) {
      remainingQueue.push(payload);
    }
  }

  localStorage.setItem('offlineExpenses', JSON.stringify(remainingQueue));

  if (remainingQueue.length === 0) {
    setStatus("All offline expenses synced successfully to Google Sheets!", "success");
    loadTours();
  } else {
    setStatus(`Synced some entries. ${remainingQueue.length} pending next connection.`, "info");
  }
}

function resetFormFields() {
  document.getElementById('bfAmount').value = '';
  document.getElementById('lunchAmount').value = '';
  document.getElementById('dinnerAmount').value = '';
  document.getElementById('stayAmount').value = '';
  document.getElementById('travelAmount').value = '';
  
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('expenseDate').value = today;
}

async function downloadExcel() {
  if (!navigator.onLine) {
    setStatus("You must be online to download the Excel sheet.", "error");
    return;
  }
  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.disabled = true;
  setStatus("Generating Excel download link...", "info");

  try {
    const response = await fetch(`${SCRIPT_URL}?action=downloadExcel`);
    const data = await response.json();

    if (data.status === 'success') {
      setStatus("Excel file download starting...", "success");
      window.open(data.downloadUrl, '_blank');
    } else {
      setStatus("Failed to generate Excel download.", "error");
    }
  } catch (error) {
    setStatus("Error triggering Excel download.", "error");
  } finally {
    downloadBtn.disabled = false;
  }
}

function setStatus(msg, type) {
  const statusMsg = document.getElementById('statusMsg');
  statusMsg.textContent = msg;
  statusMsg.className = `status-message ${type}`;
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registered!'))
      .catch(err => console.error('SW failed:', err));
  });
}

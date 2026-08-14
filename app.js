// Connected Google Apps Script Web App URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxw9iJvMfMwQ9SGeUDvd5Vr6u9AiXxTBrf7bfD80ZLIn-c2ZiEtc7YnqoyseOTHmDTbAw/exec";

// Initialize page on load
window.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('expenseDate').value = today;

  loadTours();
  
  // Auto-sync queued offline entries when internet comes back
  window.addEventListener('online', syncOfflineExpenses);
  // Check if internet is available right now on load
  if (navigator.onLine) {
    syncOfflineExpenses();
  }
});

function formatDateToDDMMYY(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year.slice(-2)}`;
}

// Load tours into dropdown
async function loadTours() {
  const tourSelect = document.getElementById('tourSelect');
  if (!navigator.onLine) return; // Skip fetch if offline
  
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getTours`);
    const data = await response.json();

    if (data.status === 'success') {
      tourSelect.innerHTML = '<option value="">-- Choose Existing Tour --</option>';
      data.tours.forEach(tour => {
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

// MAIN SAVE FUNCTION (Handles Online + Offline)
async function submitExpense() {
  const submitBtn = document.getElementById('submitBtn');
  const tourSelect = document.getElementById('tourSelect').value;
  const newTour = document.getElementById('newTourInput').value.trim();
  const tourName = newTour !== "" ? newTour : tourSelect;
  const rawDate = document.getElementById('expenseDate').value;

  if (!tourName) {
    setStatus("Please select an existing tour or enter a new tour name.", "error");
    return;
  }
  if (!rawDate) {
    setStatus("Please select a date.", "error");
    return;
  }

  const payload = {
    tourName: tourName,
    date: formatDateToDDMMYY(rawDate),
    breakfast: document.getElementById('bfAmount').value,
    lunch: document.getElementById('lunchAmount').value,
    dinner: document.getElementById('dinnerAmount').value,
    accommodation: document.getElementById('stayAmount').value,
    travelMode: document.getElementById('travelMode').value,
    travelAmount: document.getElementById('travelAmount').value
  };

  // CHECK IF OFFLINE
  if (!navigator.onLine) {
    saveToLocalQueue(payload);
    setStatus("Offline! Expense saved on phone. Will sync automatically when connected.", "info");
    resetFormFields();
    return;
  }

  // ONLINE SUBMISSION
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
    // Fallback if request failed due to sudden network loss
    saveToLocalQueue(payload);
    setStatus("Connection failed. Saved offline for auto-sync!", "info");
    resetFormFields();
  } finally {
    submitBtn.disabled = false;
  }
}

// --- LOCAL STORAGE (OFFLINE OUTBOX) FUNCTIONS ---

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
        remainingQueue.push(payload); // Retry later if error
      }
    } catch (err) {
      remainingQueue.push(payload); // Keep in queue if sync fails
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
  document.getElementById('newTourInput').value = '';
  
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

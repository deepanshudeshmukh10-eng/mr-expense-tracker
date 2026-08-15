const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxUIOyP01vNkcowYD35S8ChG1SEA_TsW8a3KG3Pzje8jHxlKAAHBIALJZBuTHb41lDQSA/exec";
let activeTourName = "";
let existingToursList = [];

const activeCategories = {
  bf: false,
  lunch: false,
  dinner: false,
  stay: false,
  travel: false
};

window.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('expenseDate').value = today;

  loadTours();

  window.addEventListener('online', syncOfflineExpenses);
  if (navigator.onLine) {
    syncOfflineExpenses();
  }
});

function goToPage1() {
  document.getElementById('page2').classList.remove('active');
  document.getElementById('page1').classList.add('active');
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

function proceedWithSelectedTour() {
  const selectVal = document.getElementById('tourSelect').value;
  if (!selectVal) {
    document.getElementById('tourError').textContent = "Please choose a tour from the dropdown.";
    return;
  }
  startTour(selectVal);
}

function proceedWithNewTour() {
  const inputVal = document.getElementById('newTourInput').value.trim();
  if (!inputVal) {
    document.getElementById('tourError').textContent = "Please type a tour name.";
    return;
  }
  
  const exists = existingToursList.some(t => t.toLowerCase() === inputVal.toLowerCase());
  if (exists) {
    document.getElementById('tourError').textContent = "This tour name already exists. Select it above.";
    return;
  }

  startTour(inputVal);
}

function startTour(tourName) {
  activeTourName = tourName;
  document.getElementById('currentTourHeading').textContent = `📋 ${tourName}`;
  document.getElementById('page1').classList.remove('active');
  document.getElementById('page2').classList.add('active');
}

// Download SPECIFIC Tour Sheet (Page 1 Button)
async function downloadSelectedTour() {
  const selectVal = document.getElementById('tourSelect').value;
  if (!selectVal) {
    setPage1Status("Please select a tour to download.", "error");
    return;
  }

  setPage1Status(`Preparing Excel for ${selectVal}...`, "info");

  try {
    const response = await fetch(`${SCRIPT_URL}?action=downloadSpecificTour&tourName=${encodeURIComponent(selectVal)}`);
    const data = await response.json();

    if (data.status === 'success') {
      setPage1Status("Download starting...", "success");
      window.open(data.downloadUrl, '_blank');
    } else {
      setPage1Status(`Error: ${data.message}`, "error");
    }
  } catch (error) {
    setPage1Status("Failed to generate download link.", "error");
  }
}

// Interactive Toggle - Input shows directly below the clicked button!
function toggleCategory(catKey) {
  activeCategories[catKey] = !activeCategories[catKey];
  
  const chipBtn = document.getElementById(`chip-${catKey}`);
  const inputGroup = document.getElementById(`group-${catKey}`);

  if (activeCategories[catKey]) {
    chipBtn.classList.add('active');
    inputGroup.classList.remove('hidden');
    const firstInput = inputGroup.querySelector('input');
    if (firstInput) firstInput.focus();
  } else {
    chipBtn.classList.remove('active');
    inputGroup.classList.add('hidden');
  }
}

async function loadTours() {
  if (!navigator.onLine) return;
  const tourSelect = document.getElementById('tourSelect');
  
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getTours`);
    const data = await response.json();

    if (data.status === 'success') {
      existingToursList = data.tours || [];
      tourSelect.innerHTML = '<option value="">(Select an existing tour)</option>';
      
      existingToursList.forEach(tour => {
        const option = document.createElement('option');
        option.value = tour;
        option.textContent = tour;
        tourSelect.appendChild(option);
      });
    }
  } catch (error) {
    tourSelect.innerHTML = '<option value="">(Offline mode - type tour below)</option>';
  }
}

function formatDateToDDMMYY(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year.slice(-2)}`;
}

async function submitExpense() {
  const submitBtn = document.getElementById('submitBtn');
  const rawDate = document.getElementById('expenseDate').value;
  const location = document.getElementById('locationInput').value.trim();

  if (!rawDate) {
    setStatus("Please select a date.", "error");
    return;
  }

  const payload = {
    tourName: activeTourName,
    date: formatDateToDDMMYY(rawDate),
    location: location,
    breakfast: activeCategories.bf ? document.getElementById('bfAmount').value : "0",
    lunch: activeCategories.lunch ? document.getElementById('lunchAmount').value : "0",
    dinner: activeCategories.dinner ? document.getElementById('dinnerAmount').value : "0",
    accommodation: activeCategories.stay ? document.getElementById('stayAmount').value : "0",
    train: activeCategories.travel ? document.getElementById('trainAmount').value : "0",
    bus: activeCategories.travel ? document.getElementById('busAmount').value : "0",
    auto: activeCategories.travel ? document.getElementById('autoAmount').value : "0",
    flight: activeCategories.travel ? document.getElementById('flightAmount').value : "0",
    otherTravel: activeCategories.travel ? document.getElementById('otherTravelAmount').value : "0"
  };

  if (!navigator.onLine) {
    saveToLocalQueue(payload);
    setStatus("Offline! Entry saved on phone. Will sync when online.", "info");
    resetFields();
    return;
  }

  submitBtn.disabled = true;
  setStatus("Saving entry...", "info");

  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (result.status === 'success') {
      setStatus(result.message, "success");
      resetFields();
      loadTours();
    } else {
      setStatus(`Error: ${result.message}`, "error");
    }
  } catch (error) {
    saveToLocalQueue(payload);
    setStatus("Network error! Saved offline for auto-sync.", "info");
    resetFields();
  } finally {
    submitBtn.disabled = false;
  }
}

function resetFields() {
  document.getElementById('locationInput').value = '';
  document.getElementById('bfAmount').value = '';
  document.getElementById('lunchAmount').value = '';
  document.getElementById('dinnerAmount').value = '';
  document.getElementById('stayAmount').value = '';
  document.getElementById('trainAmount').value = '';
  document.getElementById('busAmount').value = '';
  document.getElementById('autoAmount').value = '';
  document.getElementById('flightAmount').value = '';
  document.getElementById('otherTravelAmount').value = '';

  ['bf', 'lunch', 'dinner', 'stay', 'travel'].forEach(catKey => {
    activeCategories[catKey] = false;
    document.getElementById(`chip-${catKey}`).classList.remove('active');
    document.getElementById(`group-${catKey}`).classList.add('hidden');
  });

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('expenseDate').value = today;
}

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

  setStatus(`Syncing ${queue.length} offline entry/entries...`, "info");
  const remainingQueue = [];

  for (const payload of queue) {
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.status !== 'success') remainingQueue.push(payload);
    } catch (err) {
      remainingQueue.push(payload);
    }
  }

  localStorage.setItem('offlineExpenses', JSON.stringify(remainingQueue));
  if (remainingQueue.length === 0) {
    setStatus("All offline entries synced successfully!", "success");
    loadTours();
  }
}

function setStatus(msg, type) {
  const statusMsg = document.getElementById('statusMsg');
  statusMsg.textContent = msg;
  statusMsg.className = `status-message ${type}`;
}

function setPage1Status(msg, type) {
  const page1Status = document.getElementById('page1Status');
  page1Status.textContent = msg;
  page1Status.className = `status-message ${type}`;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error:', err));
  });
}

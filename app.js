// Connected Google Apps Script Web App URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxw9iJvMfMwQ9SGeUDvd5Vr6u9AiXxTBrf7bfD80ZLIn-c2ZiEtc7YnqoyseOTHmDTbAw/exec";

// Initialize page on load
window.addEventListener('DOMContentLoaded', () => {
  // Set date field to today's local date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('expenseDate').value = today;

  // Load existing tour names into dropdown
  loadTours();
});

// Helper: Convert YYYY-MM-DD to DD/MM/YY
function formatDateToDDMMYY(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year.slice(-2)}`;
}

// Fetch list of existing tours from Google Sheets
async function loadTours() {
  const tourSelect = document.getElementById('tourSelect');
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
    console.error("Error loading tours:", error);
  }
}

// Save Expense Submission
async function submitExpense() {
  const submitBtn = document.getElementById('submitBtn');
  const statusMsg = document.getElementById('statusMsg');

  const tourSelect = document.getElementById('tourSelect').value;
  const newTour = document.getElementById('newTourInput').value.trim();
  const tourName = newTour !== "" ? newTour : tourSelect;

  const rawDate = document.getElementById('expenseDate').value;

  // Validation
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

  // Hard UI Lock during submission
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
      loadTours(); // Refresh dropdown list
    } else {
      setStatus(`Error: ${result.message}`, "error");
    }
  } catch (error) {
    console.error("Submission failed:", error);
    setStatus("Network error. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

// Clear form after successful submit
function resetFormFields() {
  document.getElementById('bfAmount').value = '';
  document.getElementById('lunchAmount').value = '';
  document.getElementById('dinnerAmount').value = '';
  document.getElementById('stayAmount').value = '';
  document.getElementById('travelAmount').value = '';
  document.getElementById('newTourInput').value = '';
  
  // Reset date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('expenseDate').value = today;
}

// Download Excel File
async function downloadExcel() {
  const downloadBtn = document.getElementById('downloadBtn');
  const statusMsg = document.getElementById('statusMsg');

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
    console.error("Download failed:", error);
    setStatus("Error triggering Excel download.", "error");
  } finally {
    downloadBtn.disabled = false;
  }
}

// Display Status Messages
function setStatus(msg, type) {
  const statusMsg = document.getElementById('statusMsg');
  statusMsg.textContent = msg;
  statusMsg.className = `status-message ${type}`;
}

// Admin Dashboard JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Toggle sidebar on mobile
  const sidebarToggle = document.querySelector('#sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function() {
      document.querySelector('body').classList.toggle('sidebar-collapsed');
      document.querySelector('#sidebar').classList.toggle('show');
    });
  }

  // Auto-dismiss alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert-dismissible');
  alerts.forEach(alert => {
    setTimeout(() => {
      if (alert) {
        const closeButton = alert.querySelector('.btn-close');
        if (closeButton) closeButton.click();
      }
    }, 5000);
  });

  // Real-time data updates for dashboard if on dashboard page
  if (document.getElementById('transactionChart')) {
    // Update real-time stats every 30 seconds
    setInterval(fetchRealTimeStats, 30000);
  }
});

// Fetch real-time statistics for dashboard
async function fetchRealTimeStats() {
  try {
    const response = await fetch('/admin/api/transactions/stats');
    if (!response.ok) throw new Error('Failed to fetch stats');
    
    const data = await response.json();
    
    // Update the stats on the page
    const newTxElement = document.getElementById('newTransactions');
    const completedTxElement = document.getElementById('completedTransactions');
    const revenueElement = document.getElementById('revenueToday');
    
    if (newTxElement) newTxElement.textContent = data.newTransactions;
    if (completedTxElement) completedTxElement.textContent = data.completedTransactions;
    if (revenueElement) revenueElement.textContent = data.revenue.toFixed(2);
    
    console.log('Dashboard stats updated:', data);
  } catch (error) {
    console.error('Error fetching real-time stats:', error);
  }
}

// Format crypto amounts with 2 decimal places
function formatCrypto(amount) {
  return parseFloat(amount).toFixed(2);
}

// Format dates in a user-friendly way
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Copy to clipboard functionality
function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => {
      // Show a temporary tooltip or notification
      alert('Copied to clipboard: ' + text);
    })
    .catch(err => {
      console.error('Error copying to clipboard:', err);
    });
}

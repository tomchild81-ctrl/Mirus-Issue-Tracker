// Import Firebase services from the CDN
import { 
    initializeApp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, doc, addDoc, onSnapshot, collection, query, serverTimestamp, setLogLevel, 
    updateDoc, 
    increment,
    deleteField
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// --- UPDATED: Use your own Firebase Config ---
// The sandbox config is not being provided.
// 1. Create your own Firebase project at https://console.firebase.google.com/
// 2. Go to Project Settings > General > Your apps
// 3. Create a new Web App
// 4. Copy the config object given to you and paste it here.

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCTNU8k-vGiCzGFIZkmK3RXo4O2Ynd-RCU",
  authDomain: "mirus-issue-tracker.firebaseapp.com",
  projectId: "mirus-issue-tracker",
  storageBucket: "mirus-issue-tracker.firebasestorage.app",
  messagingSenderId: "326323118810",
  appId: "1:326323118810:web:cb0b92f2bc0f94754dbbe3",
  measurementId: "G-BYEBE2ZK5T"
};
        
// Use the project ID from your config for the database path
const appId = firebaseConfig.projectId || 'default-app-id';
// We will sign in anonymously since there is no sandbox token
const initialAuthToken = null; 

let db;
let auth;
let storage; // NEW: Add storage variable
let userId = null;
let isAuthReady = false;
let commentUnsubscribe = null; 

// FIXED: Re-added missing allIssues declaration
let allIssues = []; 

// REVERTED: Removed Auth View constants

// CLEANUP: Removed unused appView variable
// const appView = document.getElementById('app');

const messageBox = document.getElementById('message-box');
const messageText = document.getElementById('message-text');
const form = document.getElementById('issue-form');
const submitButton = document.getElementById('submit-button');
const issueListContainer = document.getElementById('issue-list-container');
const loadingText = document.getElementById('loading-text');
const noIssuesElement = document.getElementById('no-issues');

// Metric Elements
const metricTotal = document.getElementById('metric-total');
const metricHigh = document.getElementById('metric-high');
const metricResolved = document.getElementById('metric-resolved'); // NEW
const metricMttc = document.getElementById('metric-mttc'); // NEW

// Board Controls
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const sortBy = document.getElementById('sort-by');
const issueCountDisplay = document.getElementById('issue-count');

// Modal Elements
const issueModal = document.getElementById('issue-modal');
const modalSummary = document.getElementById('modal-summary');
const modalSeverity = document.getElementById('modal-severity');
const modalLoggedDate = document.getElementById('modal-logged-date');
const modalProject = document.getElementById('modal-project');
const modalParts = document.getElementById('modal-parts');
const modalDescription = document.getElementById('modal-description');
const modalOwner = document.getElementById('modal-owner');
const modalDepartment = document.getElementById('modal-department');
const modalReporter = document.getElementById('modal-reporter');
const modalAttachments = document.getElementById('modal-attachments');
const modalUserId = document.getElementById('modal-user-id');
const modalDocId = document.getElementById('modal-doc-id');
const modalStatusSelect = document.getElementById('modal-status-select');

// Comment Elements
const commentsList = document.getElementById('comments-list');
// CLEANUP: Removed unused noCommentsElement
// const noCommentsElement = document.getElementById('no-comments');
const commentForm = document.getElementById('comment-form');
const currentIssueIdInput = document.getElementById('current-issue-id');
const commenterNameInput = document.getElementById('commenter-name');
const commentTextInput = document.getElementById('comment-text');
const postCommentButton = document.getElementById('post-comment-button');

// A variable to hold the currently opened issue's data
let currentOpenIssue = null;

// REVERTED: Removed Auth Helper Functions

// --- App Helper Functions ---

function displayMessage(text, isError = false) {
    messageText.textContent = text;
    messageBox.classList.remove('hidden');
    // Remove previous error/success classes
    messageBox.classList.remove('border-red-600', 'bg-red-50', 'text-red-800', 'border-mustard-border', 'bg-yellow-50', 'text-yellow-800');

    if (isError) {
        messageBox.classList.add('border-red-600', 'bg-red-50', 'text-red-800');
    } else {
        messageBox.classList.add('border-mustard-border', 'bg-yellow-50', 'text-yellow-800');
    }
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 5000);
}

// --- Tab Switching Logic ---

function switchTab(view) {
    // Get view elements
    const formView = document.getElementById('form-view');
    const boardView = document.getElementById('board-view');
    const metricsView = document.getElementById('metrics-view');
    
    // Get tab button elements
    const formTab = document.getElementById('tab-form');
    const boardTab = document.getElementById('tab-board');
    const metricsTab = document.getElementById('tab-metrics');

    // Reset view classes
    [formView, boardView, metricsView].forEach(v => v.classList.add('hidden'));
    
    // Reset tab button classes
    [formTab, boardTab, metricsTab].forEach(tab => {
        tab.classList.remove('active', 'border-mustard-border', 'text-mustard-text');
        tab.classList.add('border-transparent', 'text-gray-500');
    });

    // Set active view
    if (view === 'form') {
        formView.classList.remove('hidden');
        formTab.classList.add('active', 'border-mustard-border', 'text-mustard-text');
    } else if (view === 'metrics') {
        metricsView.classList.remove('hidden');
        metricsTab.classList.add('active', 'border-mustard-border', 'text-mustard-text');
    } else if (view === 'board') {
        boardView.classList.remove('hidden');
        boardTab.classList.add('active', 'border-mustard-border', 'text-mustard-text');
    }
}

// CLEANUP: Removed exposed window functions that are no longer needed
// (Event listeners are now added in initializeFirebase)
// window.switchTab = switchTab;
// window.closeModal = closeModal; 
// window.openModal = openModal; 
// window.handleStatusUpdate = handleStatusUpdate; 
// window.handleControlChange = handleControlChange;


// --- Firebase Initialization and Auth ---

async function initializeFirebase() {
    try {
        // UPDATED: Check for the placeholder text
        if (firebaseConfig.apiKey === "PASTE_YOUR_API_KEY_HERE") {
            displayMessage("Firebase config is missing. Please paste your project's config object into the tracker.html file.", true);
            return;
        }
        
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app); // NEW: Initialize Storage

        // --- NEW: Attach all event listeners from JS ---
        
        // Tab Navigation
        document.getElementById('tab-form').addEventListener('click', () => switchTab('form'));
        document.getElementById('tab-board').addEventListener('click', () => switchTab('board'));
        document.getElementById('tab-metrics').addEventListener('click', () => switchTab('metrics'));

        // Modal close buttons
        document.getElementById('modal-overlay').addEventListener('click', closeModal);
        document.getElementById('modal-close-button').addEventListener('click', closeModal);

        // Modal status change
        document.getElementById('modal-status-select').addEventListener('change', (e) => handleStatusUpdate(e.target.value));
        
        // Attach app event listeners (forms, etc.)
        commentForm.addEventListener('submit', handleCommentSubmit);
        form.addEventListener('submit', handleIssueSubmit); // Use main issue submit handler
        
        // Attach control panel listeners
        searchInput.addEventListener('input', handleControlChange);
        filterStatus.addEventListener('change', handleControlChange);
        sortBy.addEventListener('change', handleControlChange);

        // --- NEW: Set default date and initial tab ---
        // This runs once all the elements are available.
        document.getElementById('loggedDate').valueAsDate = new Date();
        switchTab('form'); // Show the form view first
        // --- END NEW BLOCK ---

        // REVERTED: Removed Auth Event Listeners

        // --- REVERTED: Back to original anonymous auth logic ---
        const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // --- USER IS LOGGED IN (Anonymously) ---
                userId = user.uid;
                isAuthReady = true;
                console.log('User authenticated (anonymously). UID:', userId);

                // Set a default name for the comment box
                commenterNameInput.value = `User ${userId.substring(0, 6)}`;

                // Start the app
                authUnsubscribe(); // Stop listening after initial auth
                startIssueListener();
            
            } else {
                // --- NO USER ---
                // Attempt sign in if not already done
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                    // The onAuthStateChanged listener will handle the success case
                } catch (error) {
                    console.error("Authentication failed:", error);
                    displayMessage("Failed to sign in. Cannot track issues.", true);
                    isAuthReady = true; 
                }
            }
        });

        // REVERTED: Re-added initial sign-in logic
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

    } catch (error)
    {
        console.error("Firebase Initialization Error:", error);
        displayMessage("Error initializing application. Please refresh.", true);
    }
}

// REVERTED: Removed all Email/Password auth handlers

// --- Modal Functions ---

function getSeverityColor(severity) {
    switch (severity) {
        case 'Critical': return 'bg-red-500 text-white';
        case 'High': return 'bg-orange-500 text-white';
        case 'Medium': return 'bg-amber-100 text-amber-800';
        case 'Low': return 'bg-gray-200 text-gray-700';
        default: return 'bg-gray-100 text-gray-500';
    }
}

function getStatusColor(status) {
    // Utilizes CSS classes defined in the <style> block
    return `status-${status.replace(/\s/g, '')} border`; 
}

function formatIssueDate(issue) {
    let formattedDate = 'N/A';
    const dateValue = issue.loggedDate || (issue.createdAt && typeof issue.createdAt.toDate === 'function' ? issue.createdAt.toDate() : null);
    
    if (dateValue) {
         const date = (typeof dateValue === 'string') ? new Date(dateValue) : dateValue;
         formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    }
    return formattedDate;
}

function openModal(issue) {
    // 1. Clean up old listener if one exists
    if (commentUnsubscribe) {
        commentUnsubscribe();
        commentUnsubscribe = null;
    }
    commentsList.innerHTML = '<p class="text-sm text-gray-500 text-center">Loading comments...</p>';
    // REVERTED: noCommentsElement is not used
    // noCommentsElement.classList.add('hidden'); 

    // 2. Populate issue details
    // NEW: Store the full issue object globally for editing
    currentOpenIssue = issue;

    modalSummary.textContent = issue.issueSummary || 'No Summary Provided';
    modalSeverity.textContent = issue.severity;
    modalSeverity.className = `px-3 py-1 text-xs font-bold rounded-full ${getSeverityColor(issue.severity)}`;
    
    // Set the status dropdown value
    modalStatusSelect.value = issue.status || 'New';

    modalLoggedDate.textContent = formatIssueDate(issue);
    modalProject.textContent = issue.project || 'N/A';
    modalParts.textContent = issue.partNumbers || 'N/A';
    modalDescription.textContent = issue.description || 'No detailed description.';
    modalOwner.textContent = issue.owner || 'Unassigned';
    modalDepartment.textContent = issue.department || 'N/A';
    modalReporter.textContent = issue.reporter || 'Anonymous';
    
    // --- NEW: Handle showing attachments ---
    const attachmentsContainer = document.getElementById('modal-attachments');
    if (issue.attachments && issue.attachments.startsWith('http')) {
        // If it's a URL, render it as a clickable image
        attachmentsContainer.innerHTML = `
            <a href="${issue.attachments}" target="_blank" rel="noopener noreferrer" 
               class="font-medium text-blue-600 hover:underline"
               title="Click to open full image">
                <img src="${issue.attachments}" 
                     alt="Attachment" 
                     class="max-w-xs max-h-40 rounded-lg border shadow-sm mt-1">
            </a>
        `;
    } else {
        // Otherwise, just show the text (e.g., "None" or old file name)
        attachmentsContainer.innerHTML = `<p class="font-medium text-gray-800">${issue.attachments || 'None'}</p>`;
    }
    
    // IDs for debugging/tracking
    modalUserId.textContent = issue.userId ? issue.userId.substring(0, 8) + '...' : 'N/A';
    modalDocId.textContent = issue.id || 'N/A';
    
    // 3. Set the current issue ID for the comment form and status update
    currentIssueIdInput.value = issue.id;

    // 4. Start the real-time comment listener for this issue
    startCommentListener(issue.id);

    // 5. Show the modal
    issueModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden'); // Prevent background scrolling
}

function closeModal() {
    // Clean up comment listener when closing the modal
    if (commentUnsubscribe) {
        commentUnsubscribe();
        commentUnsubscribe = null;
    }
    issueModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

// --- Status Update Function ---

async function handleStatusUpdate(newStatus) {
    if (!db) {
        displayMessage("Database not ready.", true);
        return;
    }
    const issueId = currentIssueIdInput.value;
    if (!issueId) return;

    const issueDocRef = doc(db, `artifacts/${appId}/public/data/aircraft_issues`, issueId);
    
    // Prepare the data to update
    const updateData = {
        status: newStatus
    };

    // If the issue is being marked as 'Resolved', add a timestamp
    if (newStatus === 'Resolved') {
        updateData.resolvedAt = serverTimestamp();
    } 
    // If it's being moved *out* of 'Resolved', remove the timestamp
    else {
        updateData.resolvedAt = deleteField();
    }

    try {
        await updateDoc(issueDocRef, updateData);
        // The onSnapshot listener will update the UI automatically
        displayMessage(`Status for issue ${issueId.substring(0, 6)}... updated to ${newStatus}.`, false);
    } catch (error) {
        console.error("Error updating status: ", error);
        displayMessage(`Failed to update status: ${error.message}`, true);
    }
}


// --- Comment Handling Functions ---

function getCommentCollectionRef(issueId) {
    if (!db || !issueId) return null;
    // Path: /artifacts/${appId}/public/data/aircraft_issues/{issueId}/comments
    const issueRef = doc(db, `artifacts/${appId}/public/data/aircraft_issues`, issueId);
    return collection(issueRef, 'comments');
}

function renderComment(comment) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'border-l-2 border-gray-300 pl-3';
    
    let formattedTime = 'Just now';
    if (comment.createdAt && typeof comment.createdAt.toDate === 'function') {
        const date = comment.createdAt.toDate();
        formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ', ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    commentDiv.innerHTML = `
        <p class="text-sm text-gray-700 break-words">${comment.text}</p>
        <p class="text-xs text-gray-500 mt-1">
            <strong class="font-medium">${comment.commenterName || 'Anonymous'}</strong> 
            <span class="text-gray-400">| ${formattedTime}</span>
        </p>
    `;
    return commentDiv;
}

function startCommentListener(issueId) {
    const commentsRef = getCommentCollectionRef(issueId);
    if (!commentsRef) return;

    // Query to fetch comments, ordered by creation time
    const q = query(commentsRef);

    commentUnsubscribe = onSnapshot(q, (snapshot) => {
        const comments = [];
        snapshot.forEach(doc => {
            comments.push(doc.data());
        });
        
        // Sort comments by createdAt ascending (oldest first for traditional comment thread)
        comments.sort((a, b) => {
            const timeA = a.createdAt && typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate().getTime() : 0;
            const timeB = b.createdAt && typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate().getTime() : 0;
            return timeA - timeB; 
        });
        

        commentsList.innerHTML = ''; // Clear existing list

        if (comments.length === 0) {
            const p = document.createElement('p');
            p.id = 'no-comments';
            p.className = 'text-sm text-gray-500 text-center';
            p.textContent = 'No comments yet.';
            commentsList.appendChild(p);
        } else {
            comments.forEach(comment => {
                commentsList.appendChild(renderComment(comment));
            });
        }
    }, (error) => {
        console.error("Error listening to comments:", error);
        displayMessage("Failed to load real-time comments.", true);
    });
}

async function handleCommentSubmit(e) {
    e.preventDefault();
    
    if (!isAuthReady || !userId) {
        displayMessage("Please wait for authentication to complete before posting a comment.", true);
        return;
    }

    const issueId = currentIssueIdInput.value;
    const commentsRef = getCommentCollectionRef(issueId);
    const commentText = commentTextInput.value.trim();
    // Get commenter name from the editable input
    const commenterName = commenterNameInput.value.trim();

    if (!commentsRef || !issueId || !commentText || !commenterName) {
        if(!commenterName) {
            displayMessage("Please enter your name to comment.", true);
        }
        return;
    }
    
    // Get reference to the parent issue document
    const issueDocRef = doc(db, `artifacts/${appId}/public/data/aircraft_issues`, issueId);

    postCommentButton.disabled = true;
    postCommentButton.textContent = 'Posting...';

    try {
        // 1. Create the new comment object
        const newComment = {
            commenterName: commenterName,
            text: commentText,
            userId: userId,
            createdAt: serverTimestamp()
        };

        // 2. Add the comment to the sub-collection
        await addDoc(commentsRef, newComment);
        
        // 3. UPDATE THE PARENT ISSUE DOCUMENT to track comment activity
        await updateDoc(issueDocRef, {
            commentCount: increment(1),
            lastCommentedAt: serverTimestamp()
        });

        // Success
        commentTextInput.value = ''; // Clear the text area
    } catch (error) {
        console.error("Error posting comment: ", error);
        displayMessage(`Error posting comment: ${error.message}`, true);
    } finally {
        postCommentButton.disabled = false;
        postCommentButton.textContent = 'Post Comment';
    }
}


// --- Data Handling (Issues) ---

function getIssueCollectionRef() {
    if (!db) return null;
    // Public data path for collaborative tracker
    return collection(db, `artifacts/${appId}/public/data/aircraft_issues`);
}

// Severity mapping for Priority sorting
const severityOrder = {
    'Critical': 4,
    'High': 3,
    'Medium': 2,
    'Low': 1
};

/**
 * Applies the current filter, search, and sort criteria to the issue list.
 */
function filterSortAndRenderIssues() {
    let filteredIssues = [...allIssues]; // Start with a copy of all data
    
    // 1. Get current controls state
    const searchTerm = searchInput.value.toLowerCase().trim();
    const filterValue = filterStatus.value;
    const sortKey = sortBy.value;

    // 2. Filtering
    if (filterValue !== 'All') {
        filteredIssues = filteredIssues.filter(issue => issue.status === filterValue);
    }
    
    // 3. Searching
    if (searchTerm) {
        filteredIssues = filteredIssues.filter(issue => {
            const summary = (issue.issueSummary || '').toLowerCase();
            const description = (issue.description || '').toLowerCase();
            return summary.includes(searchTerm) || description.includes(searchTerm);
        });
    }

    // 4. Sorting
    filteredIssues.sort((a, b) => {
        let valA, valB;

        switch (sortKey) {
            case 'createdAt_desc':
                valA = a.createdAt && typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate().getTime() : 0;
                valB = b.createdAt && typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate().getTime() : 0;
                return valB - valA; // Newest first
            
            case 'createdAt_asc':
                valA = a.createdAt && typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate().getTime() : 0;
                valB = b.createdAt && typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate().getTime() : 0;
                return valA - valB; // Oldest first
            
            case 'priority_desc':
                valA = severityOrder[a.severity] || 0;
                valB = severityOrder[b.severity] || 0;
                return valB - valA; // Highest priority first
                
            case 'lastCommentedAt_desc':
                // If null/undefined, treat as older (0). Firestore timestamps need .toDate().getTime()
                valA = a.lastCommentedAt && typeof a.lastCommentedAt.toDate === 'function' ? a.lastCommentedAt.toDate().getTime() : 0;
                valB = b.lastCommentedAt && typeof b.lastCommentedAt.toDate === 'function' ? b.lastCommentedAt.toDate().getTime() : 0;
                return valB - valA; // Most recent comment first

            default:
                return 0; // No change
        }
    });
    
    // 5. Update UI
    issueListContainer.innerHTML = '';
    issueCountDisplay.textContent = filteredIssues.length;

    if (filteredIssues.length === 0) {
        noIssuesElement.classList.remove('hidden');
    } else {
        noIssuesElement.classList.add('hidden');
        filteredIssues.forEach(issue => {
            issueListContainer.appendChild(renderIssue(issue));
        });
    }
}

/**
 * Generic handler for any change in the control panel.
 */
function handleControlChange() {
    filterSortAndRenderIssues();
}


function renderIssue(issue) {
    const getSeverityColorClass = (severity) => {
        switch (severity) {
            case 'Critical': return 'bg-red-500 text-white';
            case 'High': return 'bg-orange-500 text-white';
            case 'Medium': return 'bg-amber-100 text-amber-800';
            case 'Low': return 'bg-gray-200 text-gray-700';
            default: return 'bg-gray-100 text-gray-500';
        }
    };
    
    const severityClass = getSeverityColorClass(issue.severity);
    const statusClass = getStatusColor(issue.status || 'New'); // Use helper function
    const formattedDate = formatIssueDate(issue);
    
    const commentCount = issue.commentCount || 0;
    
    // Comment Badge HTML
    let commentBadge = '';
    if (commentCount > 0) {
        commentBadge = `
            <span class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 ml-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                ${commentCount}
            </span>
        `;
    }

    const issueDiv = document.createElement('div');
    // Add cursor pointer and click handler
    issueDiv.className = 'p-5 border-l-4 rounded-lg shadow-md transition duration-200 hover:shadow-lg hover:bg-gray-50 cursor-pointer ' + (issue.severity === 'Critical' ? 'border-red-600' : (issue.severity === 'High' ? 'border-orange-500' : 'border-mustard-border'));
    
    // IMPORTANT: We must re-attach the click handler here!
    // FIXED: Switched to addEventListener to prevent conflicts
    issueDiv.addEventListener('click', () => openModal(issue)); 
    
    issueDiv.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <div class="flex space-x-3">
                <span class="px-3 py-1 text-xs font-bold rounded-full ${severityClass}">
                    ${issue.severity}
                </span>
                <!-- NEW STATUS BADGE -->
                <span class="px-3 py-1 text-xs font-bold rounded-full ${statusClass}">
                    ${issue.status || 'New'}
                </span>
            </div>
            <span class="text-sm text-gray-500">
                ${formattedDate}
            </span>
        </div>
        <!-- Comment badge is now rendered next to the summary -->
        <h3 class="text-lg font-bold text-gray-800 mb-1 flex items-center">
            ${issue.issueSummary || 'No Summary Provided'}
            ${commentBadge}
        </h3> 
        <p class="text-sm font-medium text-gray-700 mb-3">Affected Parts: ${issue.partNumbers || 'No Part #'}</p>
        
        <p class="text-sm text-gray-600 mb-4 truncate">${issue.description}</p>
        
        <div class="text-xs text-gray-500 space-y-1">
            <!-- Project/Seat Type moved down here -->
            <p><strong class="text-gray-700">Project:</strong> ${issue.project} | <strong class="text-gray-700">Owner:</strong> ${issue.owner} | <strong class="text-gray-700">Dept:</strong> ${issue.department}</p>
            <!-- FIXED: Corrected 'classA' to 'class' -->
            <p><strong class="text-gray-700">Logged by:</strong> ${issue.reporter} (${issue.userId.substring(0, 8)}...)</p>
            <!-- FIXED: Corrected 'text-gray-loc' to 'text-gray-700' -->
            <p><strong class="text-gray-700">Attachments:</strong> ${issue.attachments || 'None'}</p>
        </div>
    `;
    return issueDiv;
}

// UPDATED: This function now calculates all 4 metrics
function updateMetrics(issues) {
    // Metric 1: Total Issues
    metricTotal.textContent = issues.length;
    
    // Metric 2: High Severity Count
    const highCount = issues.filter(i => i.severity === 'Critical' || i.severity === 'High').length;
    metricHigh.textContent = highCount;
    
    // Metric 3: Total Resolved
    const resolvedIssues = issues.filter(i => i.status === 'Resolved');
    metricResolved.textContent = resolvedIssues.length;
    
    // Metric 4: Average Time to Resolution (MTTC)
    let totalDurationMs = 0;
    let resolvedWithTimestamps = 0;
    
    for (const issue of resolvedIssues) {
        // Check if we have both timestamps to calculate duration
        if (issue.createdAt && typeof issue.createdAt.toDate === 'function' && 
            issue.resolvedAt && typeof issue.resolvedAt.toDate === 'function') 
        {
            const createdTime = issue.createdAt.toDate().getTime();
            const resolvedTime = issue.resolvedAt.toDate().getTime();
            const duration = resolvedTime - createdTime;

            if (duration > 0) {
                totalDurationMs += duration;
                resolvedWithTimestamps++;
            }
        }
    }
    
    // Calculate and display the average
    if (resolvedWithTimestamps > 0) {
        const avgMs = totalDurationMs / resolvedWithTimestamps;
        const avgDays = avgMs / (1000 * 60 * 60 * 24); // Convert ms to days
        
        // Display in days, or hours if less than a day
        if (avgDays < 1) {
             const avgHours = avgMs / (1000 * 60 * 60);
             metricMttc.textContent = `${avgHours.toFixed(1)} Hrs`;
        } else {
             metricMttc.textContent = `${avgDays.toFixed(1)} Days`;
        }
        
    } else {
        metricMttc.textContent = 'N/A';
    }
}

function startIssueListener() {
    const issuesRef = getIssueCollectionRef();
    if (!issuesRef || !isAuthReady) return;

    onSnapshot(issuesRef, (snapshot) => {
        loadingText.classList.add('hidden');
        
        const fetchedIssues = [];
        snapshot.forEach(doc => {
            // Include the document ID for use in the modal
            fetchedIssues.push({ id: doc.id, ...doc.data() });
        });
        
        // 1. Store all issues globally
        allIssues = fetchedIssues;
        
        // 2. Filter, sort, and render based on current control state
        filterSortAndRenderIssues();

        // 3. Update Metrics (based on ALL issues, not filtered ones)
        updateMetrics(allIssues);
        
    }, (error) => {
        console.error("Error listening to issues:", error);
        loadingText.textContent = 'Error loading issues.';
        displayMessage("Failed to load real-time issues.", true);
    });
}

// --- Event Listener ---

async function handleIssueSubmit(e) {
    e.preventDefault();

    if (!isAuthReady || !userId) {
        displayMessage("Please wait for authentication to complete before logging an issue.", true);
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Logging...';
    
    let fileURL = 'None'; // Default value
    
    try {
        // --- NEW: FILE UPLOAD LOGIC ---
        const attachmentsInput = document.getElementById('attachments');
        // Check if a file was selected
        if (attachmentsInput.files && attachmentsInput.files.length > 0) {
            // We'll upload the *first* file. (Can be extended for multiple)
            const file = attachmentsInput.files[0];
            // Create a unique path in storage
            const storagePath = `attachments/${userId}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);

            submitButton.textContent = 'Uploading file...';
            
            // 1. Upload the file
            const uploadResult = await uploadBytes(storageRef, file);
            
            // 2. Get the public download URL
            fileURL = await getDownloadURL(uploadResult.ref);
            
            submitButton.textContent = 'Logging...';
        }
        
        // --- END FILE UPLOAD LOGIC ---

        const issuesRef = getIssueCollectionRef();
        if (!issuesRef) throw new Error("Database reference not available.");

        const newIssue = {
            // Get reporter name from the editable input
            reporter: document.getElementById('reporterName').value.trim(),
            severity: document.getElementById('severity').value,
            owner: document.getElementById('owner').value.trim(),
            department: document.getElementById('department').value,
            loggedDate: document.getElementById('loggedDate').value,
            issueSummary: document.getElementById('issueSummary').value.trim(),
            description: document.getElementById('description').value.trim(),
            partNumbers: document.getElementById('partNumbers').value.trim(),
            project: document.getElementById('project').value.trim(),
            attachments: fileURL, // UPDATED: Save the URL or "None"
            userId: userId, // User who logged the problem
            createdAt: serverTimestamp(),
            commentCount: 0, // Initialize to 0 on creation
            status: 'New' 
            // resolvedAt is intentionally undefined here
        };

        await addDoc(issuesRef, newIssue);

        displayMessage("Issue successfully logged! Switch tabs to see it.");
        form.reset(); // Clear the form
        
        // REVERTED: No need to auto-fill reporter name
        // But we do need to re-set the default commenter name
        commenterNameInput.value = `User ${userId.substring(0, 6)}`;


        // Manually set date to today for next entry
        document.getElementById('loggedDate').valueAsDate = new Date();

    } catch (error) {
        console.error("Error logging document: ", error);
        displayMessage(`Error logging issue: ${error.message}`, true);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Log Issue';
    }
}

// Initialize App
initializeFirebase();

// Set default date to today and set initial tab view
// MOVED: This logic is now inside initializeFirebase()
// window.onload = () => {
//      document.getElementById('loggedDate').valueAsDate = new Date();
//      switchTab('form'); // Show the form view first
// };
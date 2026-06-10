# Web Elements Testing Plan

**URL:** https://practiceautomatedtesting.com/webelements

**Purpose:** Comprehensive test plan for automated testing practice covering various web elements, widgets, and interactions.

---

## 1. Elements Section

### 1.1 Simple Input Form
**Screenshot:** `examples/screenshots/01-simple-input-form.png`

#### Test Cases:

**TC-1.1.1: Valid Form Submission**
- **Priority:** High
- **Steps:**
  1. Navigate to Simple Input Form section
  2. Enter valid full name in "Full Name" field
  3. Enter valid email in "Email" field
  4. Enter valid address in "Current Address" field
  5. Enter valid address in "Permanent Address" field
  6. Click Submit button
- **Expected Result:** Form submits successfully with confirmation

**TC-1.1.2: Empty Field Validation**
- **Priority:** Medium
- **Steps:**
  1. Navigate to Simple Input Form section
  2. Click Submit button without entering any data
- **Expected Result:** Appropriate validation messages appear

**TC-1.1.3: Email Format Validation**
- **Priority:** High
- **Steps:**
  1. Enter invalid email format (e.g., "notanemail")
  2. Attempt to submit
- **Expected Result:** Email validation error displayed

**TC-1.1.4: Special Characters Handling**
- **Priority:** Low
- **Steps:**
  1. Enter special characters in text fields
  2. Verify acceptance/rejection
- **Expected Result:** System handles special characters appropriately

---

### 1.2 Check Box
**Screenshot:** `examples/screenshots/02-check-box.png`

#### Test Cases:

**TC-1.2.1: Single Checkbox Selection**
- **Priority:** High
- **Steps:**
  1. Navigate to Check Box section
  2. Click Checkbox 1
  3. Verify checkbox is checked
- **Expected Result:** Checkbox 1 is selected

**TC-1.2.2: Multiple Checkbox Selection**
- **Priority:** High
- **Steps:**
  1. Select Checkbox 1
  2. Select Checkbox 2
  3. Select Checkbox 3
  4. Verify all are checked
- **Expected Result:** All checkboxes can be selected simultaneously

**TC-1.2.3: Checkbox Deselection**
- **Priority:** Medium
- **Steps:**
  1. Select a checkbox
  2. Click same checkbox again
- **Expected Result:** Checkbox becomes unchecked

---

### 1.3 Radio Button
**Screenshot:** `examples/screenshots/03-radio-button.png`

#### Test Cases:

**TC-1.3.1: Single Radio Selection**
- **Priority:** High
- **Steps:**
  1. Navigate to Radio Button section
  2. Select Option 1
- **Expected Result:** Option 1 is selected (default selected on page load)

**TC-1.3.2: Radio Button Mutual Exclusivity**
- **Priority:** High
- **Steps:**
  1. Select Option 1
  2. Select Option 2
  3. Verify only Option 2 is selected
- **Expected Result:** Only one radio button can be selected at a time

**TC-1.3.3: All Radio Options**
- **Priority:** Medium
- **Steps:**
  1. Iterate through all options (1, 2, 3)
  2. Verify each can be selected
- **Expected Result:** Each option can be individually selected

---

### 1.4 Web Tables
**Screenshot:** `examples/screenshots/04-web-tables.png`

#### Test Cases:

**TC-1.4.1: Table Data Verification**
- **Priority:** High
- **Steps:**
  1. Navigate to Web Tables section
  2. Verify table headers (ID, Name, Email, Role)
  3. Verify row data matches expected values
- **Expected Result:** Table displays correct data for 3 users

**TC-1.4.2: Table Row Count**
- **Priority:** Medium
- **Steps:**
  1. Count number of data rows in table
- **Expected Result:** Table contains 3 data rows

**TC-1.4.3: Cell Data Access**
- **Priority:** Medium
- **Steps:**
  1. Access specific cell by row/column
  2. Verify cell content
- **Expected Result:** Can access and verify individual cell data

---

### 1.5 Links
**Screenshot:** `examples/screenshots/05-links.png`

#### Test Cases:

**TC-1.5.1: Home Link Navigation**
- **Priority:** High
- **Steps:**
  1. Navigate to Links section
  2. Click "Home Link"
- **Expected Result:** Link is clickable (navigates to #)

**TC-1.5.2: External Link New Tab**
- **Priority:** High
- **Steps:**
  1. Click "External Link (opens in new tab)"
  2. Verify new tab opens
  3. Verify URL is https://example.com
- **Expected Result:** Link opens in new tab with correct URL

**TC-1.5.3: Link Attributes**
- **Priority:** Low
- **Steps:**
  1. Verify external link has target="_blank" attribute
- **Expected Result:** External link configured to open in new tab

---

### 1.6 Broken Links/Images
**Screenshot:** `examples/screenshots/06-broken-links-images.png`

#### Test Cases:

**TC-1.6.1: Valid Image Display**
- **Priority:** High
- **Steps:**
  1. Navigate to Broken Links/Images section
  2. Verify "Valid Image" displays correctly
- **Expected Result:** Valid placeholder image loads successfully

**TC-1.6.2: Broken Image Detection**
- **Priority:** High
- **Steps:**
  1. Verify "Broken Image" element
  2. Check for image load error
- **Expected Result:** Broken image fails to load (network error detected)

**TC-1.6.3: Image Alt Text**
- **Priority:** Medium
- **Steps:**
  1. Verify alt text for both images
- **Expected Result:** Appropriate alt text present for accessibility

---

### 1.7 Upload and Download
**Screenshot:** `examples/screenshots/07-upload-download.png`

#### Test Cases:

**TC-1.7.1: File Upload**
- **Priority:** High
- **Steps:**
  1. Navigate to Upload and Download section
  2. Click "Choose File" button
  3. Select a valid file
  4. Verify file is selected
- **Expected Result:** File upload dialog opens and file can be selected

**TC-1.7.2: File Type Validation**
- **Priority:** Medium
- **Steps:**
  1. Attempt to upload various file types
  2. Verify acceptance/rejection
- **Expected Result:** System validates file types appropriately

**TC-1.7.3: Download Sample File**
- **Priority:** High
- **Steps:**
  1. Click "Download Sample File" link
  2. Verify download initiates
- **Expected Result:** File download starts successfully

---

### 1.8 Shadow DOM
**Screenshot:** `examples/screenshots/08-shadow-dom.png`

#### Test Cases:

**TC-1.8.1: Shadow DOM Element Access**
- **Priority:** High
- **Steps:**
  1. Navigate to Shadow DOM section
  2. Locate shadow DOM input field
  3. Enter text in shadow DOM input
- **Expected Result:** Can access and interact with shadow DOM elements

**TC-1.8.2: Shadow DOM Input Functionality**
- **Priority:** Medium
- **Steps:**
  1. Type text in shadow DOM input
  2. Verify text appears correctly
- **Expected Result:** Shadow DOM input accepts and displays text

---

### 1.9 Select Box
**Screenshot:** `examples/screenshots/09-select-box.png`

#### Test Cases:

**TC-1.9.1: Dropdown Selection**
- **Priority:** High
- **Steps:**
  1. Navigate to Select Box section
  2. Click dropdown
  3. Select "Option 1"
- **Expected Result:** Option 1 is selected

**TC-1.9.2: All Dropdown Options**
- **Priority:** Medium
- **Steps:**
  1. Open dropdown
  2. Verify all options present (Select an option, Option 1, Option 2, Option 3)
  3. Select each option sequentially
- **Expected Result:** All options can be selected

**TC-1.9.3: Default Selection**
- **Priority:** Low
- **Steps:**
  1. Verify default selected value
- **Expected Result:** "Select an option..." is default

---

## 2. Widgets Section

### 2.1 Date Picker
**Screenshot:** `examples/screenshots/10-date-picker.png`

#### Test Cases:

**TC-2.1.1: Date Selection**
- **Priority:** High
- **Steps:**
  1. Navigate to Date Picker section
  2. Click date input field
  3. Select a date from calendar
- **Expected Result:** Selected date appears in input field

**TC-2.1.2: Manual Date Entry**
- **Priority:** Medium
- **Steps:**
  1. Click date input
  2. Manually type date
- **Expected Result:** Date can be entered manually

**TC-2.1.3: Date Format Validation**
- **Priority:** Medium
- **Steps:**
  1. Enter various date formats
  2. Verify acceptance/rejection
- **Expected Result:** System validates date format

---

### 2.2 Slider
**Screenshot:** `examples/screenshots/11-slider.png`

#### Test Cases:

**TC-2.2.1: Slider Movement**
- **Priority:** High
- **Steps:**
  1. Navigate to Slider section
  2. Drag slider handle to different position
  3. Verify value changes (0-100)
- **Expected Result:** Slider value updates correctly

**TC-2.2.2: Min/Max Values**
- **Priority:** Medium
- **Steps:**
  1. Move slider to minimum (0)
  2. Move slider to maximum (100)
- **Expected Result:** Slider respects min/max bounds

**TC-2.2.3: Default Value**
- **Priority:** Low
- **Steps:**
  1. Verify initial slider value
- **Expected Result:** Default value is 50

---

### 2.3 Progress Bar
**Screenshot:** `examples/screenshots/12-progress-bar.png`

#### Test Cases:

**TC-2.3.1: Start Progress Animation**
- **Priority:** High
- **Steps:**
  1. Navigate to Progress Bar section
  2. Click "Start Progress" button
  3. Observe progress bar animation
- **Expected Result:** Progress bar animates from 0% to 100%

**TC-2.3.2: Reset Button State**
- **Priority:** Medium
- **Steps:**
  1. Verify "Reset" button is disabled initially
  2. Start progress
  3. Verify "Reset" button becomes enabled
- **Expected Result:** Reset button state changes appropriately

**TC-2.3.3: Progress Completion**
- **Priority:** High
- **Steps:**
  1. Start progress
  2. Wait for completion
  3. Verify progress reaches 100%
- **Expected Result:** Progress completes at 100%

---

### 2.4 Tabs
**Screenshot:** `examples/screenshots/13-tabs.png`

#### Test Cases:

**TC-2.4.1: Tab Navigation**
- **Priority:** High
- **Steps:**
  1. Navigate to Tabs section
  2. Click Tab 2
  3. Verify content changes
- **Expected Result:** Tab content updates to show Tab 2 content

**TC-2.4.2: All Tabs Accessible**
- **Priority:** High
- **Steps:**
  1. Click through all tabs (Tab 1, Tab 2, Tab 3)
  2. Verify each shows different content
- **Expected Result:** Each tab displays unique content

**TC-2.4.3: Active Tab Indicator**
- **Priority:** Low
- **Steps:**
  1. Switch between tabs
  2. Verify active tab is visually indicated
- **Expected Result:** Active tab has visual indicator

---

### 2.5 Hover and Tooltip
**Screenshot:** `examples/screenshots/14-hover-tooltip.png`

#### Test Cases:

**TC-2.5.1: Tooltip Display on Hover**
- **Priority:** High
- **Steps:**
  1. Navigate to Hover and Tooltip section
  2. Hover over "Hover me" button
  3. Verify tooltip appears
- **Expected Result:** Tooltip displays on hover

**TC-2.5.2: Tooltip Hide on Mouse Leave**
- **Priority:** Medium
- **Steps:**
  1. Hover to show tooltip
  2. Move mouse away
- **Expected Result:** Tooltip disappears when mouse leaves

**TC-2.5.3: Tooltip Content**
- **Priority:** Low
- **Steps:**
  1. Display tooltip
  2. Verify tooltip text content
- **Expected Result:** Tooltip contains expected text

---

### 2.6 Accordion
**Screenshot:** `examples/screenshots/15-accordion.png`

#### Test Cases:

**TC-2.6.1: Accordion Expand**
- **Priority:** High
- **Steps:**
  1. Navigate to Accordion section
  2. Click "Section 1"
  3. Verify section expands
- **Expected Result:** Section 1 expands showing content

**TC-2.6.2: Accordion Collapse**
- **Priority:** High
- **Steps:**
  1. Expand a section
  2. Click same section header again
- **Expected Result:** Section collapses

**TC-2.6.3: Multiple Sections**
- **Priority:** Medium
- **Steps:**
  1. Verify multiple accordion sections exist
  2. Test expanding different sections
- **Expected Result:** All accordion sections function correctly

---

### 2.7 Menu
**Screenshot:** `examples/screenshots/16-menu.png`

#### Test Cases:

**TC-2.7.1: Menu Item Click**
- **Priority:** High
- **Steps:**
  1. Navigate to Menu section
  2. Click "Menu Item 1"
- **Expected Result:** Menu item is clickable

**TC-2.7.2: All Menu Items**
- **Priority:** Medium
- **Steps:**
  1. Click each menu item (1, 2, 3)
  2. Verify all are functional
- **Expected Result:** All menu items are accessible

**TC-2.7.3: Menu Navigation**
- **Priority:** Low
- **Steps:**
  1. Verify menu items have proper navigation attributes
- **Expected Result:** Menu items configured correctly

---

## 3. Interactions Section

### 3.1 Resize
**Screenshot:** `examples/screenshots/17-resize.png`

#### Test Cases:

**TC-3.1.1: Resize Element**
- **Priority:** High
- **Steps:**
  1. Navigate to Resize section
  2. Drag bottom-right corner to resize box
  3. Verify size changes
- **Expected Result:** Box can be resized by dragging

**TC-3.1.2: Resize Constraints**
- **Priority:** Medium
- **Steps:**
  1. Attempt to resize beyond boundaries
  2. Verify min/max constraints
- **Expected Result:** Resize respects constraints

---

### 3.2 Drag and Drop
**Screenshot:** `examples/screenshots/18-drag-drop.png`

#### Test Cases:

**TC-3.2.1: Drag Single Item**
- **Priority:** High
- **Steps:**
  1. Navigate to Drag and Drop section
  2. Drag "Item 1" to drop zone
  3. Verify item is dropped
- **Expected Result:** Item 1 can be dragged and dropped

**TC-3.2.2: Drag Multiple Items**
- **Priority:** High
- **Steps:**
  1. Drag Item 1 to drop zone
  2. Drag Item 2 to drop zone
  3. Drag Item 3 to drop zone
- **Expected Result:** All items can be dragged to drop zone

**TC-3.2.3: Drop Zone Validation**
- **Priority:** Medium
- **Steps:**
  1. Drag item outside drop zone
  2. Verify behavior
- **Expected Result:** Items only drop in valid drop zone

---

### 3.3 Geolocation
**Screenshot:** `examples/screenshots/19-geolocation.png`

#### Test Cases:

**TC-3.3.1: Get Location**
- **Priority:** High
- **Steps:**
  1. Navigate to Geolocation section
  2. Click "Get Location" button
  3. Allow/deny location permission
- **Expected Result:** Location permission dialog appears

**TC-3.3.2: Location Permission Granted**
- **Priority:** Medium
- **Steps:**
  1. Grant location permission
  2. Verify coordinates displayed
- **Expected Result:** Current location coordinates shown

**TC-3.3.3: Location Permission Denied**
- **Priority:** Medium
- **Steps:**
  1. Deny location permission
  2. Verify error handling
- **Expected Result:** Appropriate error message displayed

---

### 3.4 Sorting
**Screenshot:** `examples/screenshots/20-sorting.png`

#### Test Cases:

**TC-3.4.1: Sort by Name**
- **Priority:** High
- **Steps:**
  1. Navigate to Sorting section
  2. Click "Name" header
  3. Verify table sorts alphabetically
- **Expected Result:** Table rows sorted by name (ascending/descending)

**TC-3.4.2: Sort by Age**
- **Priority:** High
- **Steps:**
  1. Click "Age" header
  2. Verify table sorts numerically
- **Expected Result:** Table rows sorted by age (ascending/descending)

**TC-3.4.3: Sort Toggle**
- **Priority:** Medium
- **Steps:**
  1. Click header once for ascending
  2. Click again for descending
- **Expected Result:** Sort direction toggles

---

### 3.5 Frame
**Screenshot:** `examples/screenshots/21-frame.png`

#### Test Cases:

**TC-3.5.1: Access Frame 1**
- **Priority:** High
- **Steps:**
  1. Navigate to Frame section
  2. Switch to Frame 1
  3. Verify frame content
- **Expected Result:** Can access Frame 1 content

**TC-3.5.2: Access Frame 2**
- **Priority:** High
- **Steps:**
  1. Switch to Frame 2
  2. Verify frame content
- **Expected Result:** Can access Frame 2 content

**TC-3.5.3: Frame Switching**
- **Priority:** Medium
- **Steps:**
  1. Switch between frames
  2. Interact with elements in each
- **Expected Result:** Can successfully switch and interact with nested frames

---

### 3.6 Keypress
**Screenshot:** `examples/screenshots/22-keypress.png`

#### Test Cases:

**TC-3.6.1: Key Detection**
- **Priority:** High
- **Steps:**
  1. Navigate to Keypress section
  2. Click input field
  3. Press any key
  4. Verify key is detected and displayed
- **Expected Result:** Pressed key is detected and shown

**TC-3.6.2: Special Keys**
- **Priority:** Medium
- **Steps:**
  1. Press special keys (Enter, Tab, Arrow keys)
  2. Verify detection
- **Expected Result:** Special keys are detected

**TC-3.6.3: Multiple Keypresses**
- **Priority:** Low
- **Steps:**
  1. Press multiple keys in sequence
  2. Verify each is detected
- **Expected Result:** All keypresses detected correctly

---

### 3.7 Modal
**Screenshot:** `examples/screenshots/23-modal.png`

#### Test Cases:

**TC-3.7.1: Open Modal**
- **Priority:** High
- **Steps:**
  1. Navigate to Modal section
  2. Click "Open Modal" button
  3. Verify modal appears
- **Expected Result:** Modal dialog displays

**TC-3.7.2: Close Modal**
- **Priority:** High
- **Steps:**
  1. Open modal
  2. Click close button/outside modal
  3. Verify modal closes
- **Expected Result:** Modal can be closed

**TC-3.7.3: Modal Content**
- **Priority:** Medium
- **Steps:**
  1. Open modal
  2. Verify modal content is accessible
- **Expected Result:** Modal content displays correctly

---

### 3.8 Alert
**Screenshot:** `examples/screenshots/24-alert.png`

#### Test Cases:

**TC-3.8.1: Show Alert Dialog**
- **Priority:** High
- **Steps:**
  1. Navigate to Alert section
  2. Click "Show Alert" button
  3. Verify alert appears
  4. Accept alert
- **Expected Result:** Alert dialog displays and can be accepted

**TC-3.8.2: Show Confirm Dialog**
- **Priority:** High
- **Steps:**
  1. Click "Show Confirm" button
  2. Verify confirm dialog appears
  3. Test OK and Cancel buttons
- **Expected Result:** Confirm dialog displays with OK/Cancel options

**TC-3.8.3: Show Prompt Dialog**
- **Priority:** High
- **Steps:**
  1. Click "Show Prompt" button
  2. Enter text in prompt
  3. Verify prompt accepts input
- **Expected Result:** Prompt dialog displays and accepts user input

---

## Test Execution Strategy

### Priority Levels:
- **High Priority:** Core functionality that must work
- **Medium Priority:** Important features that should work
- **Low Priority:** Nice-to-have features

### Test Environments:
- Chrome (Desktop)
- Firefox (Desktop)
- Safari (Desktop)
- Mobile browsers (Chrome, Safari)

### Automation Approach:
1. Start with high-priority test cases
2. Use Playwright, Selenium, Cypress, or WebdriverIO
3. Implement Page Object Model for maintainability
4. Add screenshots for failed tests
5. Generate HTML reports

### Cross-Browser Considerations:
- Shadow DOM support varies
- Alert handling differs across browsers
- File upload dialogs are browser-specific
- Geolocation permissions vary by browser

---

## Notes:
- All screenshots saved in `examples/screenshots/` directory
- 24 total interactive examples tested
- Website designed for automation practice
- Some features may require specific browser permissions (geolocation, file access)

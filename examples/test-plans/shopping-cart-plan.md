# Shopping Section - Comprehensive Test Plan

## Application Overview

The Shopping section at https://practiceautomatedtesting.com/shop provides a complete e-commerce experience for practicing test automation. The application features:

- **Product Catalog**: Browse and search products
- **Product Details**: View individual product information, images, and pricing
- **Shopping Cart**: Add/remove items, update quantities
- **Cart Summary**: View totals, taxes, shipping calculations
- **Checkout Process**: Multi-step checkout with billing and shipping
- **Payment Integration**: Payment form validation (test mode)
- **Order Confirmation**: Receipt and order summary

## Test Scenarios

### 1. Product Browsing

**Seed:** `tests/seed.spec.ts`

#### 1.1 View Product Catalog
**Steps:**
1. Navigate to https://practiceautomatedtesting.com/shop
2. Observe the product listing page
3. Verify products are displayed

**Expected Results:**
- Multiple products visible on the page
- Each product shows image, name, and price
- Products are arranged in a grid or list layout
- Page loads within 3 seconds

#### 1.2 Product Image Display
**Steps:**
1. Navigate to https://practiceautomatedtesting.com/shop
2. Verify product images are loaded
3. Check image quality and aspect ratio

**Expected Results:**
- All product images load successfully
- No broken image icons
- Images are clear and properly sized
- Alt text present for accessibility

#### 1.3 Product Pricing Display
**Steps:**
1. Navigate to https://practiceautomatedtesting.com/shop
2. Verify price is shown for each product
3. Check price formatting

**Expected Results:**
- Price displays with currency symbol (e.g., $)
- Price formatted correctly (e.g., $29.99)
- No missing or $0.00 prices (unless intentional)
- Sale prices/discounts clearly marked (if applicable)

#### 1.4 Product Sorting
**Steps:**
1. Navigate to https://practiceautomatedtesting.com/shop
2. Locate sort dropdown (if available)
3. Select "Price: Low to High"
4. Verify products reorder

**Expected Results:**
- Products reorder based on selected sort
- Cheapest product appears first
- Sort maintains stability (same price items stay in order)
- Page doesn't reload unnecessarily

#### 1.5 Product Search/Filter
**Steps:**
1. Navigate to https://practiceautomatedtesting.com/shop
2. Enter search term or use filter (e.g., category)
3. Verify filtered results

**Expected Results:**
- Only matching products display
- Search is case-insensitive
- No results message if nothing matches
- Clear filter option available

### 2. Product Detail Page

#### 2.1 View Single Product Details
**Steps:**
1. Navigate to https://practiceautomatedtesting.com/shop
2. Click on a product (e.g., first product in list)
3. Verify product detail page loads

**Expected Results:**
- Product detail page opens
- Large product image displays
- Product name, price, description visible
- Add to Cart button present
- Breadcrumb navigation shows current location

#### 2.2 Product Image Gallery
**Steps:**
1. Open a product detail page
2. Click on thumbnail images or navigation arrows
3. Verify main image updates

**Expected Results:**
- Clicking thumbnails changes main image
- Image zoom functionality works (if available)
- Multiple product angles visible
- Image transitions are smooth

#### 2.3 Product Description
**Steps:**
1. Open a product detail page
2. Read the product description section
3. Verify formatting and content

**Expected Results:**
- Description text is readable
- Formatting (bold, lists, etc.) renders correctly
- Product specifications/features listed
- No Lorem ipsum placeholder text

#### 2.4 Quantity Selection
**Steps:**
1. Open a product detail page
2. Locate quantity input/selector
3. Change quantity to 3
4. Verify value updates

**Expected Results:**
- Quantity can be changed (via input or +/- buttons)
- Minimum quantity is 1
- Invalid values (0, negative, non-numeric) rejected
- Quantity reflects in cart when added

### 3. Adding Items to Cart

#### 3.1 Add Single Item to Cart
**Steps:**
1. Navigate to https://practiceautomatedtesting.com/shop
2. Click "Add to Cart" on any product
3. Verify item is added

**Expected Results:**
- Success message appears (e.g., "Item added to cart")
- Cart icon/counter updates to show 1 item
- User can continue shopping
- Product remains on page (no navigation unless intended)

#### 3.2 Add Multiple Different Items
**Steps:**
1. Navigate to https://practiceautomatedtesting.com/shop
2. Add first product to cart
3. Add second product to cart
4. Add third product to cart

**Expected Results:**
- Cart counter shows 3 items
- Each product added successfully
- Success confirmation for each addition
- Cart maintains all items

#### 3.3 Add Same Item Multiple Times
**Steps:**
1. Navigate to https://practiceautomatedtesting.com/shop
2. Add same product to cart
3. Add same product again
4. View cart

**Expected Results:**
- Either quantity increments to 2, or item appears twice
- Cart behavior is consistent with design
- Total price reflects quantity

#### 3.4 Add Item with Specific Quantity
**Steps:**
1. Open a product detail page
2. Set quantity to 5
3. Click "Add to Cart"

**Expected Results:**
- Cart shows 5 units of product
- Price multiplies correctly (5 × unit price)
- Cart counter shows correct count

#### 3.5 Add to Cart from Product List vs Detail Page
**Steps:**
1. Add product from main shop page
2. Add different product from its detail page
3. View cart

**Expected Results:**
- Both methods successfully add to cart
- Cart contains both products
- No difference in behavior or data

### 4. Shopping Cart Management

#### 4.1 View Cart Contents
**Steps:**
1. Add items to cart
2. Click cart icon or "View Cart" button
3. Navigate to cart page

**Expected Results:**
- Cart page displays all added items
- Each item shows image, name, price, quantity
- Subtotal for each line item displayed
- Cart total shown at bottom

#### 4.2 Update Item Quantity in Cart
**Steps:**
1. Add item to cart
2. Navigate to cart page
3. Change quantity from 1 to 3
4. Update or refresh

**Expected Results:**
- Quantity updates to 3
- Line item total recalculates (price × 3)
- Cart total updates automatically
- Update button triggers recalculation

#### 4.3 Increase Quantity to Maximum
**Steps:**
1. Add item to cart
2. Attempt to set quantity to 99 or 100
3. Update cart

**Expected Results:**
- System accepts reasonable high quantities, or
- Shows max quantity limit with error message
- Stock availability checked (if applicable)

#### 4.4 Decrease Quantity to Zero
**Steps:**
1. Add item to cart
2. Set quantity to 0
3. Update cart

**Expected Results:**
- Item is removed from cart, or
- Error message prevents setting to 0
- Behavior is clear to user

#### 4.5 Remove Item from Cart
**Steps:**
1. Add multiple items to cart
2. Navigate to cart page
3. Click "Remove" or "X" button on one item

**Expected Results:**
- Selected item is removed
- Other items remain in cart
- Cart totals recalculate
- Confirmation message shown

#### 4.6 Remove All Items (Empty Cart)
**Steps:**
1. Add items to cart
2. Remove each item one by one

**Expected Results:**
- After last removal, cart is empty
- "Your cart is empty" message displays
- Cart counter shows 0
- Checkout button disabled or hidden

#### 4.7 Cart Persistence Across Pages
**Steps:**
1. Add items to cart
2. Navigate to other pages (About, Contact, etc.)
3. Return to cart or check cart counter

**Expected Results:**
- Cart contents persist during session
- Cart counter remains accurate on all pages
- Items not lost during navigation

### 5. Cart Calculations

#### 5.1 Subtotal Calculation
**Steps:**
1. Add item costing $25
2. Add item costing $15
3. View cart

**Expected Results:**
- Subtotal shows $40
- Math is accurate
- Currency formatting correct

#### 5.2 Tax Calculation
**Steps:**
1. Add items to cart
2. Proceed toward checkout or view cart totals
3. Verify tax amount

**Expected Results:**
- Tax calculated on subtotal (e.g., 8% = $3.20 on $40)
- Tax rate displayed
- Tax line item shown separately

#### 5.3 Shipping Cost
**Steps:**
1. Add items to cart
2. View shipping costs (may appear at checkout)

**Expected Results:**
- Shipping cost shown (or "FREE" if applicable)
- Multiple shipping options if available
- Cost updates based on shipping method

#### 5.4 Total Amount
**Steps:**
1. Add items to cart
2. View final total

**Expected Results:**
- Total = Subtotal + Tax + Shipping
- Calculation is accurate
- Total clearly labeled

#### 5.5 Discount/Coupon Code
**Steps:**
1. Add items to cart
2. Enter a valid coupon code (if feature exists)
3. Apply coupon

**Expected Results:**
- Discount applied to subtotal
- Discount amount shown as line item
- Total recalculates correctly
- Invalid codes show error message

### 6. Checkout Process

#### 6.1 Proceed to Checkout
**Steps:**
1. Add items to cart
2. Click "Proceed to Checkout" button

**Expected Results:**
- Checkout page loads
- Cart summary visible
- Billing/shipping form displayed
- Progress indicator shows step 1 (if multi-step)

#### 6.2 Billing Information Form
**Steps:**
1. Navigate to checkout
2. Fill in all required billing fields:
   - First Name: "John"
   - Last Name: "Doe"
   - Email: "john@example.com"
   - Phone: "555-1234"
   - Address: "123 Main St"
   - City: "Springfield"
   - State: "IL"
   - ZIP: "62701"

**Expected Results:**
- All fields accept input
- Required fields marked with asterisk (*)
- Email validation works
- Phone number format validation (if applicable)

#### 6.3 Billing Form Validation - Empty Fields
**Steps:**
1. Navigate to checkout
2. Leave required fields empty
3. Click "Continue" or "Next"

**Expected Results:**
- Error messages appear for empty required fields
- Form does not submit
- Focus moves to first invalid field
- Clear indication of what's missing

#### 6.4 Billing Form Validation - Invalid Email
**Steps:**
1. Navigate to checkout
2. Enter "notanemail" in email field
3. Continue to next step

**Expected Results:**
- Email validation error appears
- Form does not proceed
- Error message indicates proper email format needed

#### 6.5 Shipping Address Same as Billing
**Steps:**
1. Fill billing information
2. Check "Ship to same address" checkbox (if available)
3. Proceed

**Expected Results:**
- Shipping form is skipped or auto-filled
- No need to re-enter same information
- Proceeding to payment or review step

#### 6.6 Different Shipping Address
**Steps:**
1. Fill billing information
2. Choose different shipping address option
3. Enter separate shipping address

**Expected Results:**
- Shipping address form appears
- Can enter different address
- Both addresses saved for order

#### 6.7 Payment Information
**Steps:**
1. Proceed to payment step
2. Fill in payment details:
   - Card Number: "4111111111111111" (test card)
   - Expiry: "12/25"
   - CVV: "123"
   - Name on Card: "John Doe"

**Expected Results:**
- Payment form accepts test card data
- Card number formatting applied (spaces every 4 digits)
- Expiry date validates (future date required)
- CVV accepts 3-4 digits

#### 6.8 Payment Form Validation
**Steps:**
1. Navigate to payment step
2. Enter invalid card number
3. Enter expired date
4. Attempt to proceed

**Expected Results:**
- Invalid card number rejected
- Expired date shows error
- Form does not submit
- Clear error messages shown

#### 6.9 Order Review Before Submission
**Steps:**
1. Complete billing, shipping, payment
2. View order review/summary page

**Expected Results:**
- All entered information displayed for review
- Cart contents shown with quantities and prices
- Total amount clearly visible
- Edit options available for each section
- Terms and conditions checkbox (if applicable)

#### 6.10 Place Order
**Steps:**
1. Complete all checkout steps
2. Review order summary
3. Click "Place Order" or "Complete Purchase"

**Expected Results:**
- Order processes successfully
- Loading indicator shown during processing
- Redirect to order confirmation page
- No errors in console

### 7. Order Confirmation

#### 7.1 Confirmation Page Display
**Steps:**
1. Complete an order
2. View confirmation page

**Expected Results:**
- Success message displayed (e.g., "Thank you for your order!")
- Order number generated and shown
- Order summary with all details
- Estimated delivery date (if applicable)

#### 7.2 Confirmation Email Reference
**Steps:**
1. Complete an order
2. Check confirmation page for email reference

**Expected Results:**
- Message indicates confirmation email sent
- Shows email address where sent
- Instructions for checking spam folder

#### 7.3 Cart Cleared After Order
**Steps:**
1. Complete an order
2. Navigate back to cart or shop

**Expected Results:**
- Cart is now empty
- Cart counter shows 0
- Can start new shopping session

#### 7.4 Order Details on Confirmation
**Steps:**
1. Complete an order
2. Review all details on confirmation page

**Expected Results:**
- Items ordered with quantities and prices
- Billing address shown
- Shipping address shown
- Payment method shown (last 4 digits only)
- Total amount charged

### 8. Edge Cases and Error Scenarios

#### 8.1 Out of Stock Item
**Steps:**
1. Attempt to add out-of-stock item to cart (if feature exists)

**Expected Results:**
- "Out of Stock" indicator visible
- Add to Cart button disabled
- Cannot add to cart
- Notification option for restock (optional)

#### 8.2 Session Timeout
**Steps:**
1. Add items to cart
2. Wait for extended period (simulate timeout)
3. Attempt to checkout

**Expected Results:**
- Session timeout message or cart persists
- User not lose cart on timeout
- Can resume checkout or re-login

#### 8.3 Network Error During Checkout
**Steps:**
1. Simulate network interruption during payment
2. Observe error handling

**Expected Results:**
- Error message shown to user
- Order not submitted multiple times
- User can retry
- No partial orders created

#### 8.4 Browser Back Button During Checkout
**Steps:**
1. Begin checkout process
2. Click browser back button
3. Click forward button

**Expected Results:**
- Form data preserved when navigating back
- Can resume checkout where left off
- No duplicate orders from navigation

#### 8.5 Cart with Maximum Items
**Steps:**
1. Add many different products to cart (e.g., 20+ items)
2. View cart page

**Expected Results:**
- Cart handles large number of items
- Page remains performant
- Scrolling works smoothly
- Totals calculate correctly

## Testing Notes

- All monetary values should be tested for accuracy
- Test with different product price ranges ($0.99 to $999.99)
- Cross-browser testing essential (Chrome, Firefox, Safari, Edge)
- Mobile responsive design should be verified
- Payment processing uses test mode (no real charges)
- Test data should be realistic but clearly marked as test

## Success Criteria

- Complete shopping flow from browse to order confirmation
- All calculations are mathematically correct
- Form validations prevent invalid data
- Error messages are clear and actionable
- Cart persists across user session
- Checkout process is intuitive with <= 5 steps
- Order confirmation provides all necessary details
- No console errors or broken functionality
- Page load times under 3 seconds
- Mobile and desktop experiences are smooth

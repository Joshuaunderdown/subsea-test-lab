# Project: Subsea Test Lab
## Interactive Software Validation Demonstration

Build a polished, mobile-friendly web application called **Subsea Test Lab**, designed to demonstrate software testing and validation concepts for a Software Validation Engineer interview at Sonardyne International.

The application should simulate an underwater navigation system and allow users to run automated tests, introduce simulated faults, observe failures and verify that fixes work. The main goal is to demonstrate functional testing, verification, validation, regression testing, integration testing and fault handling through a live interactive demo.

The project must be accessible through a public URL and work on mobile phones, so interviewers can scan a QR code and interact with it without installing anything.

## 1. Technology stack

Use the following technologies:

- Next.js with TypeScript.
- Tailwind CSS for responsive styling.
- React for interactive UI components.
- Vitest for automated unit and regression tests.
- GitHub Actions for automatically running tests when code is pushed.
- Vercel for public deployment.

Keep the application lightweight. The live demo must not require authentication, a database, API keys or access to physical hardware.

## 2. Core functionality

### A. Navigation simulator

Create a simplified underwater vehicle navigation simulator.

The simulator should display:
- A simulated underwater vehicle.
- Its expected position.
- Its measured position.
- The position error.
- Sensor status.
- Current simulation status.

Use a simple two-dimensional coordinate system rather than attempting to reproduce real subsea navigation physics.

Allow the user to run the simulation and generate reproducible sensor readings. Use a deterministic random seed or predefined scenarios so the same test can be repeated consistently.

Clearly label all data as simulated.

### B. Automated testing dashboard

Create a dashboard showing a suite of automated tests.

Include the following test cases:

1. **Normal sensor reading:** Confirm the measured position is within the defined tolerance.
2. **Missing sensor data:** Confirm missing readings are handled safely.
3. **Invalid coordinates:** Confirm invalid inputs are rejected.
4. **Position error threshold:** Confirm the system detects when position error exceeds the specified limit.
5. **Sensor failure:** Confirm a simulated sensor failure produces an appropriate warning.
6. **Regression test:** Confirm previously verified behaviour remains correct after changes.
7. **Recovery test:** Confirm the system returns to normal operation after a fault is cleared.

Each test must have:
- A unique test ID.
- A description.
- Expected behaviour.
- Actual result.
- PASS or FAIL status.
- A short explanation of any failure.

Test outcomes must be calculated by real test logic in the application. Do not hard-code every test to pass.

### C. Interactive fault injection

Provide a clearly visible button labelled "Inject Sensor Fault".

When clicked:
- Introduce a controlled fault into the simulated sensor data.
- Update the navigation display.
- Run the relevant validation checks.
- Show failed tests where appropriate.
- Explain why the system failed the test.

Provide a "Clear Fault" or "Reset Simulation" button to restore normal operation.

Also include scenarios for missing readings and excessive position error.

Fault injection must affect the actual simulation and test results, not just change the interface appearance.

### D. Run Test Suite

Add a prominent "Run Test Suite" button.

When clicked:
- Execute all defined checks.
- Evaluate actual outputs against expected results.
- Display the results for each test.
- Show the total number of tests, passed tests and failed tests.
- Display the overall suite status.
- Provide a short summary of detected issues.

Ensure the displayed results accurately reflect the checks that were executed.

### E. Regression testing demonstration

Include a dedicated regression testing section.

The user should be able to:
1. Run the baseline tests.
2. Introduce a simulated defect.
3. Rerun the tests and see the relevant failure.
4. Remove the defect.
5. Rerun the tests and confirm recovery.

Use a clearly explained, controlled fault scenario. Make it obvious which tests detect the defect and why.

Explain that regression testing checks whether changes introduce unintended problems in previously working functionality.

The web demonstration may simulate the process, but the repository must also contain genuine automated regression tests that can be executed with Vitest.

## 3. Verification and validation

Include a section explaining the distinction between verification and validation.

**Verification:** Does the system meet its specified requirements?

Example: Check that the calculated position error stays within a defined numerical tolerance for valid inputs.

**Validation:** Does the system behave appropriately for its intended use?

Example: Check that the simulated navigation system identifies unreliable sensor readings rather than presenting them as trustworthy positions.

Create a simple requirements traceability table linking requirements to test IDs and results.

Use fictional demonstration requirements and state clearly that they are not Sonardyne product specifications.

## 4. User interface and design

Build a professional engineering dashboard with a modern marine technology aesthetic.

Visual direction:
- Deep navy blue, white and subtle cyan accents.
- Clean typography and clear spacing.
- Simple charts and coordinate visualisations.
- Clear status indicators for PASS, FAIL and WARNING.
- Responsive cards and tables.
- Minimal animations.
- No unnecessary decorative elements.

The interface should feel like a credible engineering test tool rather than a generic landing page.

The main dashboard should contain:

1. Project title and short description.
2. Navigation simulator.
3. Current sensor and system status.
4. Run Test Suite button.
5. Fault injection controls.
6. Automated test results.
7. Regression testing demonstration.
8. Verification and validation explanations.
9. Requirements traceability table.

Prioritise usability on a mobile phone. Buttons must be large enough to tap, tables must fit smaller screens, and the most important test results should be visible without excessive scrolling.

## 5. Automated tests

Implement genuine Vitest tests covering the underlying navigation and validation logic.

Include tests for:
- Valid navigation inputs.
- Invalid coordinates.
- Missing sensor data.
- Position error calculations.
- Threshold boundaries.
- Sensor failure handling.
- Recovery after a fault.
- Regression against known baseline scenarios.

Use deterministic inputs and explicit assertions.

Include at least one test that would fail if a deliberate defect were introduced into the calculation logic.

Organise the code so the simulation logic is separated from the user interface and can be tested independently.

## 6. Documentation

Create a comprehensive README.md containing:

- Project purpose.
- Why it is relevant to software validation engineering.
- Technology stack.
- Architecture overview.
- Instructions to run the project locally.
- Instructions to run the automated tests.
- Explanation of each testing type demonstrated.
- Example test results.
- Limitations of the simulation.
- Deployment instructions.

Explain how the project demonstrates verification, validation, functional testing, integration testing, fault injection and regression testing.

Do not claim the application represents real Sonardyne technology or has been validated against real underwater equipment.

## 7. Deployment and QR code

Prepare the project for deployment to Vercel.

The application must work through a public HTTPS URL, including when opened directly from a QR code on a mobile phone.

Create a separate printable project information page containing:
- Project title.
- One-sentence description.
- A genuine QR code linking to the deployed application.
- A short list of the testing concepts demonstrated.

Do not generate a fake QR code or encode a placeholder URL. Generate the final QR code only after the public deployment URL is known, and ensure that it points to the correct live application.

If deployment credentials or external account access are unavailable, provide clear deployment instructions and a QR code generation script that accepts the final URL.

## 8. Quality requirements

- Build a fully functioning application, not just a static mockup.
- Implement the actual simulation and test logic.
- Avoid placeholder buttons and fabricated results.
- Ensure all controls work on desktop and mobile.
- Handle unexpected inputs without crashing.
- Keep the code readable, maintainable and appropriately documented.
- Verify that the project builds successfully and that the automated test suite passes.
- Report any tests that fail rather than hiding or ignoring them.

## Final objective

Deliver a small but convincing software validation portfolio project that an interviewer can open on their phone, explore in under two minutes, and use to see how I approach testing, fault detection, defect investigation and regression testing.

The strongest demonstration should be the ability to introduce a simulated defect, observe the relevant tests fail, correct the defect and rerun the suite to demonstrate recovery.

export const instructions = `
Tutorial on Efficiently Using the Rental Test Page and Adding New Scenarios/Actions

Title: Руководство по Эффективному Использованию Тестовой Страницы Аренды и Добавлению Новых Сценариев/Действий

Introduction:

This tutorial explains how to effectively use the rental test page (\`/app/admin/rental-tester/page.tsx\`) and provides a step-by-step guide on adding new scenarios and actions for automated testing. This page is designed to streamline the process of testing various rental flows and ensures that new features integrate smoothly.

1. Understanding the Existing Components:

•  Scenario Control (Управление Сценарием):
  •  Select Scenario (Выберите Сценарий): This dropdown allows you to choose a predefined rental scenario. Each scenario sets up an initial state for testing specific functionalities.
  •  Setup Scenario (Настроить Сценарий): This button initializes the selected scenario, creating test users, a rental, and any necessary initial data in the database.
  •  Cleanup Data (Очистить Данные): This button removes all data associated with the current rental, ensuring a clean slate for new tests.

•  Action Control (Управление Действиями):
  •  Act As (Действовать от имени...): This dropdown lets you choose whether to perform actions as the "renter" (арендатор) or the "owner" (владелец).
  •  Available Actions (Доступные Действия): This section displays a list of actions that can be performed based on the selected actor and the current state of the rental.

•  Event Stream (Поток Событий):
  •  This area displays a live stream of events related to the rental. Each event represents a change in the rental's state.

•  Telegram Log (Журнал Telegram (Имитация)):
  •  This section simulates Telegram notifications that would be sent during a real rental, providing insight into how the system communicates with users.

2. Using the Test Page Effectively:

•  Start with a Scenario: Choose a scenario that matches the functionality you want to test.
•  Examine Initial State: Use the Event Stream and Rental Status to understand the initial state of the rental.
•  Act as the Correct User: Select the "renter" or "owner" based on who should be performing the next action.
•  Trigger Actions: Click the appropriate action button and observe the changes in the Event Stream, Telegram Log, and Rental Status.
•  Repeat: Continue triggering actions to simulate the complete rental flow.

3. Adding a New Scenario:

•  Modify the SCENARIOS Array:
  •  Open \`/app/admin/rental-tester/page.tsx\`.
  •  Add a new object to the SCENARIOS array with the following structure:
\`\`\`
    {
      id: "unique_scenario_id", // Unique identifier for your scenario
      label: "Название Сценария", // Human-readable name (in Russian)
      description: "Описание Сценария", // A brief description of the scenario (in Russian)
    }
\`\`\`
*  Implement the Scenario Logic in setupTestScenario:
  •  Open \`/app/admin/rental-tester/actions.ts\`.
  •  Modify the setupTestScenario function to handle your new scenario_id. Add conditional logic to create the specific initial state required for your scenario. This might involve:
    *  Creating specific database records (rentals, events, etc.).
    *  Setting rental statuses.
\`\`\`
    export async function setupTestScenario(scenario: string) {
      // ... existing code ...

      if (scenario === 'unique_scenario_id') {
        // Your logic to create the initial state for this scenario
        // Example:
        await supabaseAdmin.from('rentals').update({ status: 'new_status' }).eq('rental_id', rentalId);
      }

      // ... existing code ...
    }
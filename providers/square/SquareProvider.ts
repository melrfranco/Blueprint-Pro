import { SalonProvider } from "../SalonProvider";
import { SquareIntegrationService } from "../../services/squareIntegration";

export const SquareProvider: SalonProvider = {
  provider: "square",

  fetchClients: async () => {
    return SquareIntegrationService.fetchCustomers();
  },

  fetchServices: async () => {
    return SquareIntegrationService.fetchCatalog();
  },

  createBooking: async (input) => {
    const location = await SquareIntegrationService.fetchLocation();
    return SquareIntegrationService.createAppointment({
      locationId: location.id,
      startAt: input.startTime,
      customerId: input.clientExternalId,
      teamMemberId: '', // Will be resolved by the service
      services: input.services,
    });
  },
};

/// <reference types="cypress" />
import { customer, worker, makeOrder, makeRequest, professional } from "../../src/test/workflowFixtures";
import type { Order } from "../../src/types/serviprox";

// Pruebas del navegador con API interceptada. La persistencia real se comprueba en Django.
function openWorkflow(role: "client" | "professional", path: string, initialOrder: Order | null, diagnosisPayload?: unknown, diagnosisDelayMs = 0) {
  let order = initialOrder;
  const request = makeRequest({ status: order ? "accepted" : "open", order });
  const user = role === "professional" ? worker : customer;
  const actions = { accepted: 0, rejected: 0, prices: 0 };
  const transitions: Record<string, string[]> = {
    accepted: ["cancelled", "scheduled", "traveling"], scheduled: ["cancelled", "traveling"],
    traveling: ["arrived", "cancelled"], arrived: ["in_progress", "cancelled"],
    in_progress: ["break", "completed", "cancelled"], completed: [], cancelled: [],
  };
  const service = { id: 5, category: 1, category_slug: "plomeria", name: "Reparar fuga", slug: "reparar-fuga", description: "", price_min: "50000", price_max: "90000", estimated_hours: null };
  const offering = { id: 4, service: 5, service_name: service.name, service_slug: service.slug, category: 1, category_name: "Plomería", category_slug: "plomeria", price_min: "50000", price_max: "90000", observaciones: "Revisión y reparación", years_experience: 3 };
  cy.intercept("**/api/v1/**", (http) => {
    const resource = new URL(http.url).pathname.split("/api/v1/")[1];
    if (resource === "auth/me/") return http.reply(user);
    if (resource === "health/") return http.reply({ status: "ok", database: "connected" });
    if (resource === "platform/settings/") return http.reply({ features: { maintenance: false }, maintenance_message: "" });
    if (resource === "categories/") return http.reply([request.selected_category]);
    if (resource === "services/") return http.reply([service]);
    if (resource === "professionals/") return http.reply([professional]);
    if (resource === "professionals/2/") return http.reply({ ...professional, bio: "Profesional de prueba", coverage_radius_km: 10, response_time_minutes: 20, services: [offering], availability: [], portfolio: [], created_at: user.created_at });
    if (resource === "services/5/") return http.reply(service);
    if (resource === "households/") return http.reply([request.household]);
    if (resource === "diagnosis/sessions/") {
      http.alias = "orientedSearch";
      return http.reply({ statusCode: 201, delay: diagnosisDelayMs, body: diagnosisPayload === undefined ? {
      id: 81, suggested_category: request.selected_category, rationale: "Servicios relacionados con tu problema.",
      service_ranking: [{ id: service.id, name: service.name, category: request.selected_category }],
      } : diagnosisPayload });
    }
    if (resource === "requests/31/accept/" && http.method === "POST") {
      actions.accepted += 1;
      http.alias = "acceptServiceRequest";
      order = makeOrder(); request.status = "accepted"; request.status_label = "Aceptada";
      return http.reply({ ...request, order });
    }
    if (resource === "requests/31/reject/" && http.method === "POST") {
      actions.rejected += 1;
      http.alias = "rejectServiceRequest";
      request.status = "rejected"; request.status_label = "Rechazada";
      return http.reply({ ...request, order });
    }
    if (resource === "requests/31/") return http.reply({ ...request, order });
    if (resource === "requests/" && http.method === "POST") {
      http.alias = "createServiceRequest";
      request.images = [{ id: 41, image_url: "/api/v1/requests/31/images/41/", created_at: user.created_at }];
      return http.reply({ statusCode: 201, body: { ...request, order } });
    }
    if (resource === "requests/") return http.reply({ count: 1, next: null, previous: null, results: [{ ...request, order }] });
    if (resource === "orders/") return http.reply({ count: order ? 1 : 0, next: null, previous: null, results: order ? [order] : [] });
    if (resource === "orders/7/transition/" && order) {
      const status = http.body.status as string;
      order = { ...order, status, available_transitions: transitions[status] || [], events: [...order.events, { id: order.events.length + 1, status, status_label: status, note: "", created_at: new Date().toISOString() }] };
      if (status === "completed") request.status = "closed";
      return http.reply(order);
    }
    if (resource === "orders/7/price/" && order) { actions.prices += 1; http.alias = "setFinalPrice"; order = { ...order, final_price: http.body.final_price }; return http.reply(order); }
    if (resource === "orders/7/") return http.reply(order ? { ...order, viewer_role: role, can_set_final_price: role === "professional",
      price_bounds: { min: order.estimate_min, max: order.estimate_max }, arrival_code: role === "client" ? "1234" : "" } : { detail: "No existe una orden." });
    return http.reply({ statusCode: 404, body: { detail: "Recurso fuera del escenario de prueba" } });
  });
  cy.intercept("https://router.project-osrm.org/**", { body: { routes: [{ distance: 1200, duration: 240, geometry: { coordinates: [[-74.06, 4.65], [-74.07, 4.64]] } }] } });
  cy.intercept("https://*.tile.openstreetmap.org/**", { statusCode: 204 });
  cy.intercept("https://nominatim.openstreetmap.org/**", []);
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.localStorage.setItem("serviprox_cached_user", JSON.stringify(user));
      win.localStorage.setItem("serviprox_access_token", "workflow-browser-test");
      Object.defineProperty(win.navigator, "geolocation", { configurable: true, value: { watchPosition: () => 1, clearWatch: () => undefined } });
    },
  });
  cy.get('[aria-label="Cargando Serviprox"]', { timeout: 15000 }).should("not.exist");
  return actions;
}

describe("Seguimiento persistente y responsive", { defaultCommandTimeout: 10000 }, () => {
  it("el cliente consulta el precio confirmado sin controles de tarifa ni ejecución profesional", () => {
    openWorkflow("client", "/seguimiento/7", makeOrder({ final_price: "75000" }));
    cy.contains("Tarifa confirmada por el profesional").should("be.visible");
    cy.get('[aria-label="Opciones del cliente"]').should("be.visible");
    cy.get('[aria-label="Herramientas del profesional"]').should("not.exist");
    cy.get('input[name="final-price"]').should("not.exist");
    cy.contains("button", "Iniciar desplazamiento").should("not.exist");
    cy.contains("button", "Terminar trabajo").should("not.exist");
    cy.contains("ion-button", "Ver pago del servicio").should("be.visible");
  });

  it("el profesional solo puede enviar una tarifa dentro del rango publicado", () => {
    const actions = openWorkflow("professional", "/seguimiento/7", makeOrder({ status: "in_progress" }));
    cy.get('input[name="final-price"]').should("have.attr", "min", "50000").and("have.attr", "max", "90000").type("90000.01");
    cy.contains("button", "Guardar valor final").click();
    cy.then(() => expect(actions.prices).to.eq(0));
    cy.get('input[name="final-price"]').clear().type("90000");
    cy.contains("button", "Guardar valor final").click();
    cy.wait("@setFinalPrice");
    cy.then(() => expect(actions.prices).to.eq(1));
    cy.get('[aria-label="Opciones del cliente"]').should("not.exist");
  });

  it("abrir el perfil propio por URL no permite enviar una solicitud", () => {
    cy.intercept({ method: "GET", url: "**/api/v1/professionals/2/", middleware: true }, { ...professional, is_own_profile: true,
      bio: "Mi perfil", coverage_radius_km: 10, response_time_minutes: 20, availability: [], portfolio: [], created_at: customer.created_at,
      services: [{ id: 4, service: 5, service_name: "Reparar fuga", price_min: "50000", price_max: "90000", observaciones: "", years_experience: 3 }],
    });
    openWorkflow("client", "/cliente/profesionales/2?service=5", null);
    cy.contains('[role="alert"]', "Este es tu perfil profesional").should("be.visible");
    cy.get("textarea").type("Tengo una fuga de agua");
    cy.contains("button", "Enviar solicitud a").should("be.disabled");
  });

  it("alterna carga y resultados tres veces con IonButton e IonSpinner reales ya inicializados", () => {
    openWorkflow("client", "/cliente/servicios", null, undefined, 1200);
    cy.contains("ion-button", "Orientación guiada").click();
    // Las pruebas unitarias usan mocks de Ionic: esta regresión exige sus Web Components reales.
    cy.get("ion-modal.sp-diag-modal .sp-guided-search-button").shadow().find("button").should("be.visible");
    cy.get("ion-modal.sp-diag-modal .sp-guided-search-button ion-spinner").shadow().find("svg").should("exist");
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      cy.get("ion-modal.sp-diag-modal textarea").clear().type(`Tengo una fuga de agua en la tubería ${attempt}`);
      cy.get("ion-modal.sp-diag-modal .sp-guided-search-button").click();
      cy.get("ion-modal.sp-diag-modal .sp-guided-search-button").should("contain.text", "Buscando en el catálogo...").and("have.prop", "disabled", true);
      cy.get('ion-modal.sp-diag-modal .sp-service-button-content[aria-busy="true"]').should("be.visible");
      cy.get("ion-modal.sp-diag-modal textarea").should("be.disabled");
      cy.wait("@orientedSearch");
      cy.get("ion-modal.sp-diag-modal .sp-guided-search-button").should("contain.text", "Buscar sugerencias").and("have.prop", "disabled", false);
      cy.get('ion-modal.sp-diag-modal [aria-label="Resultado de la búsqueda"]').should("be.visible").and("contain.text", "Reparar fuga");
    }
  });

  for (const legacyRanking of [false, true]) {
    it(`completa orientación guiada sin pantalla vacía con ${legacyRanking ? "ranking omitido" : "términos omitidos"}`, () => {
      cy.viewport(390, 850);
      openWorkflow("client", "/cliente/servicios", null, legacyRanking ? {
        id: 81, suggested_category: makeRequest().selected_category, rationale: "Elige un servicio de esta categoría.",
      } : undefined);
      cy.contains("ion-button", "Orientación guiada").click();
      cy.get('ion-modal.sp-diag-modal textarea').type("Tengo una fuga de agua");
      cy.contains("ion-modal.sp-diag-modal ion-button", "Buscar sugerencias").click();
      cy.get('ion-modal.sp-diag-modal [aria-label="Resultado de la búsqueda"]').should("be.visible");
      cy.contains("ion-modal.sp-diag-modal .sp-diag-suggestion", "Reparar fuga").click();
      cy.get("ion-modal.sp-diag-modal ion-content").should("have.css", "background-color", "rgb(244, 246, 250)");
      cy.contains("ion-modal.sp-diag-modal ion-button", "Continuar con el servicio seleccionado").should(($button) => {
        expect(getComputedStyle($button[0]).getPropertyValue("--background").trim()).to.eq("#dc2626");
      }).click();
      cy.get("ion-modal.sp-service-modal").should("be.visible");
      cy.get('ion-modal.sp-service-modal textarea[id="description"]').should("have.value", "Tengo una fuga de agua");
    });
  }

  it("una respuesta inválida de orientación muestra un error y conserva el formulario", () => {
    openWorkflow("client", "/cliente/servicios", null, null);
    cy.contains("ion-button", "Orientación guiada").click();
    cy.get("ion-modal.sp-diag-modal textarea").type("Tengo una fuga de agua");
    cy.contains("ion-modal.sp-diag-modal ion-button", "Buscar sugerencias").click();
    cy.get('ion-modal.sp-diag-modal [role="alert"]').should("contain.text", "No pudimos consultar las sugerencias");
    cy.contains("ion-modal.sp-diag-modal ion-button", "Buscar sugerencias").should("not.be.disabled");
    cy.get("ion-modal.sp-diag-modal textarea").should("have.value", "Tengo una fuga de agua");
  });

  it("acepta con el diálogo real de Ionic y nunca llama a rechazar", () => {
    const actions = openWorkflow("professional", "/profesional/solicitudes/31", null);
    cy.get('ion-button[aria-label="Aceptar solicitud"]').click();
    cy.get("ion-alert").filter(":visible").contains("button", "Aceptar solicitud").click();
    cy.wait("@acceptServiceRequest");
    cy.location("pathname").should("eq", "/seguimiento/7");
    cy.contains("h1", "Aceptado").should("be.visible");
    cy.then(() => { expect(actions.accepted).to.eq(1); expect(actions.rejected).to.eq(0); });
  });

  it("volver de la confirmación no cambia la solicitud y rechazar requiere su propia confirmación", () => {
    const actions = openWorkflow("professional", "/profesional/solicitudes/31", null);
    cy.get('ion-button[aria-label="Aceptar solicitud"]').click();
    cy.get("ion-alert").filter(":visible").contains("button", "Volver").click();
    cy.then(() => { expect(actions.accepted).to.eq(0); expect(actions.rejected).to.eq(0); });
    cy.get('ion-button[aria-label="Rechazar solicitud"]').click();
    cy.get("ion-alert").filter(":visible").contains("button", "Rechazar solicitud").click();
    cy.wait("@rejectServiceRequest");
    cy.contains("ion-badge", "Rechazada").should("be.visible");
    cy.then(() => { expect(actions.accepted).to.eq(0); expect(actions.rejected).to.eq(1); });
  });

  for (const width of [360, 1440]) {
    it(`permite adjuntar fotos antes del envío en el modal ampliado a ${width}px`, () => {
      cy.viewport(width, 900);
      openWorkflow("client", "/cliente/servicios", null);
      cy.contains("ion-button", "Tomar el servicio").click();
      cy.get("ion-modal.sp-service-modal").should("be.visible").then(($modal) => {
        const dialog = $modal[0].getBoundingClientRect();
        // El host cubre el viewport; el tamaño del panel se comprueba en su parte expuesta.
        expect(dialog.width).to.be.at.most(width + 1);
        const panel = $modal[0].shadowRoot?.querySelector('[part="content"]');
        expect(panel, "panel del modal").to.exist;
        expect(panel!.getBoundingClientRect().width).to.be.at.least(width * .9);
      });
      cy.get("ion-modal.sp-service-modal ion-content").should("have.css", "background-color", "rgb(244, 246, 250)");
      cy.get('ion-modal [aria-label="Etapas del servicio"] [aria-current="step"]').should("contain.text", "Solicitud");
      cy.get('ion-modal textarea[id="description"]').type("Fuga debajo del lavamanos");
      cy.get('ion-modal input[aria-label="Fotos del problema"]').selectFile({
        contents: Cypress.Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6M5kAAAAASUVORK5CYII=", "base64"), fileName: "problema.png", mimeType: "image/png",
      }, { force: true });
      cy.get('ion-modal img[alt="Foto adjunta 1"]').scrollIntoView().should("be.visible");
      cy.get("ion-modal .sp-service-modal-body").should(($body) => expect($body[0].scrollWidth).to.be.at.most($body[0].clientWidth + 1));
      cy.contains("ion-modal ion-button", "Confirmar dirección y tomar servicio").click();
      cy.wait("@createServiceRequest").its("request.headers.content-type").should("include", "multipart/form-data");
      cy.location("pathname").should("eq", "/seguimiento/solicitud/31");
    });
  }

  it("recupera una solicitud pendiente al recargar y desde las solicitudes del cliente", () => {
    openWorkflow("client", "/seguimiento/solicitud/31", null);
    cy.contains("h1", "Pendiente de aceptación").should("be.visible");
    cy.get(".sp-tracking-map").should("not.exist");
    cy.reload();
    cy.get('[aria-label="Cargando Serviprox"]', { timeout: 15000 }).should("not.exist");
    cy.contains("h1", "Pendiente de aceptación").should("be.visible");
    cy.contains("ion-button", "Volver a mis solicitudes").click();
    cy.contains("ion-button", "Ver seguimiento").click();
    cy.location("pathname").should("eq", "/seguimiento/solicitud/31");
    cy.contains("h1", "Pendiente de aceptación").should("be.visible");
  });

  it("retira el mapa al llegar, permite finalizar sin pago y retoma el resumen desde Mis trabajos", () => {
    openWorkflow("professional", "/seguimiento/7", makeOrder());
    cy.contains("button", "Iniciar desplazamiento").click();
    cy.get(".sp-tracking-map").should("be.visible");
    cy.get('input[name="arrival-code"]').type("1234");
    cy.contains("button", "Confirmar llegada").click();
    cy.contains("h1", "Profesional en el lugar").should("be.visible");
    cy.get(".sp-tracking-map").should("not.exist");
    cy.contains("button", "Comenzar o reanudar trabajo").click();
    cy.get('input[name="final-price"]').type("75000");
    cy.contains("button", "Guardar valor final").click();
    cy.contains("button", "Terminar trabajo").click();
    cy.get("ion-alert").should("be.visible").contains("button", "Confirmar").click();
    cy.contains("h2", "Resumen del trabajo terminado").should("be.visible");
    cy.contains("strong", "Pendiente de pago").should("be.visible");
    cy.contains("ion-button", "Volver a mis trabajos").click();
    cy.get(".sp-job-filters select").select("history");
    cy.contains("ion-button", "Ver resumen").click();
    cy.contains("h2", "Resumen del trabajo terminado").should("be.visible");
  });

  for (const width of [320, 360, 390, 768, 1024]) {
    for (const role of ["client", "professional"] as const) {
      it(`adapta seguimiento y listas de ${role} a ${width}px con texto largo`, () => {
        cy.viewport(width, 850);
        const order = makeOrder({ status: "in_progress", available_transitions: role === "professional" ? ["completed"] : [], workplace_address: "Dirección".repeat(20), professional: { ...professional, display_name: "Profesional".repeat(12) } });
        openWorkflow(role, "/seguimiento/7", order);
        cy.contains("h1", "Trabajando").should("be.visible");
        // Evita que los fondos globales rosa/azul de cada perfil vuelvan a imponerse al flujo.
        cy.get(".ion-page.sp-service-flow").filter(":visible").find("ion-content").should("have.css", "background-color", "rgb(244, 246, 250)");
        cy.get(".ion-page.sp-service-flow").filter(":visible").find("ion-toolbar").should(($toolbar) => {
          const palette = getComputedStyle($toolbar[0]);
          expect(palette.getPropertyValue("--background").trim()).to.eq("#ffffff");
          expect(palette.getPropertyValue("--ion-color-primary").trim()).to.eq(role === "professional" ? "#193f70" : "#dc2626");
        });
        cy.get('[aria-label="Etapas del servicio"] [aria-current="step"]').should("contain.text", "Visita");
        cy.get(".tracking-page").should(($page) => expect($page[0].scrollWidth).to.be.at.most($page[0].clientWidth + 1));
        cy.contains("ion-button", role === "professional" ? "Volver a mis trabajos" : "Volver a mis solicitudes").click();
        cy.get(role === "professional" ? ".sp-role-page" : ".sp-reservas-container").should(($page) => expect($page[0].scrollWidth).to.be.at.most($page[0].clientWidth + 1));
      });
    }
    it(`adapta el formulario de solicitud directa a ${width}px`, () => {
      cy.viewport(width, 850);
      openWorkflow("client", "/cliente/profesionales/2?service=5", null);
      cy.contains("h2", "Detalles de tu solicitud").should("be.visible");
      cy.get(".sp-request-page-wrapper").should(($page) => expect($page[0].scrollWidth).to.be.at.most($page[0].clientWidth + 1));
    });
  }
});

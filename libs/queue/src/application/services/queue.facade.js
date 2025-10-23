"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueFacade = void 0;
const common_1 = require("@nestjs/common");
const queue_ticket_service_1 = require("./queue-ticket.service");
let QueueFacade = class QueueFacade {
    queueTicketService;
    constructor(queueTicketService) {
        this.queueTicketService = queueTicketService;
    }
    enqueue(userId, eventId) {
        return this.queueTicketService.enqueue(userId, eventId);
    }
    getStatus(ticketId) {
        return this.queueTicketService.getStatus(ticketId);
    }
    enter(userId, ticketId, gateToken) {
        return this.queueTicketService.enter(userId, ticketId, gateToken);
    }
};
exports.QueueFacade = QueueFacade;
exports.QueueFacade = QueueFacade = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [queue_ticket_service_1.QueueTicketService])
], QueueFacade);
//# sourceMappingURL=queue.facade.js.map
import { Global, Logger, Module } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OnGatewayInit, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Namespace, Socket } from "socket.io";
import type { AccessTokenPayload } from "../../common/auth.guard";

export const tenantRoom = (tenantId: string) => `tenant:${tenantId}`;
export const userRoom = (userId: string) => `user:${userId}`;

/**
 * Pushes stock and channel-sync changes to every open screen of a shop.
 * Clients authenticate with their access token in the handshake
 * (`auth: { token }`); an invalid/expired token fails the connection with
 * "unauthorized" so the client can refresh and reconnect.
 */
@WebSocketGateway({
  namespace: "/realtime",
  cors: { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true },
})
export class RealtimeGateway implements OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);
  @WebSocketServer() private server!: Namespace;

  constructor(private readonly jwt: JwtService) {}

  afterInit(server: Namespace) {
    server.use(async (socket: Socket, next) => {
      try {
        const payload = await this.jwt.verifyAsync<AccessTokenPayload>(String(socket.handshake.auth?.token ?? ""));
        socket.data.user = { userId: payload.sub, tenantId: payload.tid, role: payload.role };
        await socket.join([tenantRoom(payload.tid), userRoom(payload.sub)]);
        next();
      } catch {
        next(new Error("unauthorized"));
      }
    });
  }

  emitToTenant(tenantId: string, event: string, payload: unknown) {
    if (!this.server) return this.logger.warn(`Gateway not ready, dropped ${event}`);
    this.server.to(tenantRoom(tenantId)).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown) {
    if (!this.server || !userIds.length) return;
    this.server.to(userIds.map(userRoom)).emit(event, payload);
  }
}

@Global()
@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}

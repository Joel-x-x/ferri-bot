import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { envs } from '../../config/envs';

@WebSocketGateway({
  cors: {
    origin: [envs.frontendUrl, 'http://localhost:4200'],
    credentials: true,
  },
})
export class WhatsappGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WhatsappGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string)?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: envs.jwt.secret,
        issuer: envs.jwt.issuer,
      });

      const tenantId = payload.tenantId;
      if (!tenantId) {
        client.disconnect();
        return;
      }

      client.data.tenantId = tenantId;
      client.data.userId = payload.sub;
      client.join(tenantId);

      this.logger.log(`ws.client_connected clientId=${client.id} tenant=${tenantId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`ws.client_disconnected clientId=${client.id}`);
  }

  emitToTenant(tenantId: string, event: string, data: any) {
    this.server.to(tenantId).emit(event, data);
  }
}

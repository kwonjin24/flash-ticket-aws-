import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { User } from '@api/domain/auth/entities/user.entity';
import { JwtPayload } from './jwt-payload.interface';
declare const JwtRefreshStrategy_base: new (...args: any) => any;
export declare class JwtRefreshStrategy extends JwtRefreshStrategy_base {
    private readonly usersRepository;
    constructor(configService: ConfigService, usersRepository: Repository<User>);
    validate(payload: JwtPayload): Promise<User>;
}
export {};

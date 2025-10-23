import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { User } from '@api/domain/auth/entities/user.entity';
import { JwtPayload } from './jwt-payload.interface';
declare const JwtStrategy_base: new (...args: any) => any;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly usersRepository;
    constructor(configService: ConfigService, usersRepository: Repository<User>);
    validate(payload: JwtPayload): Promise<User>;
}
export {};

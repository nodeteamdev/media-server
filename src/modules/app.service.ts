import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    getInfo() {
        // eslint-disable-next-line global-require
        const { version, description } = require('../../package.json');

        return {
            version,
            description,
        };
    }
}

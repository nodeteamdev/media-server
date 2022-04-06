import { Logger } from '@nestjs/common';
import * as mediasoup from 'mediasoup';

/**
 * A worker represents a mediasoup C++ subprocess
 * that runs in a single CPU core and handles Transport instances.
 */
export class Worker {
    private logger: Logger = new Logger(Worker.name);

    worker: mediasoup.types.Worker;

    options: {
        'resourceInterval': number;
        'resourceLogLevel': string;
        'workerPool': number;
        'worker': mediasoup.types.WorkerSettings,
        'router': mediasoup.types.RouterOptions
    };

    constructor(options) {
        this.logger.debug('Create Mediasoup worker with next config');
        this.logger.debug(options);

        this.options = options;
    }

    /**
     * Worker
     * |-> Transport(s)
     *     |-> Producer Transport(s)
     *         |-> Producer
     *     |-> Consumer Transport(s)
     *         |-> Consumer
     * */
    async startWorker() {
        this.worker = await mediasoup.createWorker(this.options.worker);

        this.logger.debug(`Worker PID ${this.worker.pid} started`);

        this.worker.on('died', (error) => {
            this.logger.error('Mediasoup worker has died.');
            this.logger.error(error);
            setTimeout(() => process.exit(1), 2000);
        });

        this.getLogResourceUsage(this.worker);

        return this.worker;
    }

    /**
     * @param worker {mediasoup.types.Worker}
     * @private
     */
    private getLogResourceUsage(worker) {
        setInterval(() => {
            worker.getResourceUsage().then((data) => {
                if (this.options.resourceLogLevel === 'short') {
                    this.logger.debug(data);
                } else {
                    this.logger.debug(`integral unshared data size 'ru_idrss':${data.ru_idrss}`);
                    this.logger.debug(`block input operations 'ru_inblock':${data.ru_inblock}`);
                    this.logger.debug(`integral unshared stack size 'ru_isrss':${data.ru_isrss}`);
                    this.logger.debug(`integral shared memory size 'ru_ixrss': ${data.ru_ixrss}`);
                    this.logger.debug(`page faults (hard page faults) 'ru_majflt': ${data.ru_majflt}`);
                    this.logger.debug(`maximum resident set size 'ru_maxrss':${data.ru_maxrss}`);
                    this.logger.debug(`page reclaims (soft page faults) 'ru_minflt':${data.ru_minflt}`);
                    this.logger.debug(`IPC messages received 'ru_msgrcv': ${data.ru_msgrcv}`);
                    this.logger.debug(`IPC messages sent 'ru_msgsnd':${data.ru_msgsnd}`);
                    this.logger.debug(`involuntary context switches 'ru_nivcsw':${data.ru_nivcsw}`);
                    this.logger.debug(`signals received 'ru_nsignals':${data.ru_nsignals}`);
                    this.logger.debug(`swaps 'ru_nswap':${data.ru_nswap}`);
                    this.logger.debug(` voluntary context switches 'ru_nvcsw':${data.ru_nvcsw}`);
                    this.logger.debug(`block output operations 'ru_oublock':${data.ru_oublock}`);
                    this.logger.debug(`system CPU time used 'ru_stime':${data.ru_stime}`);
                    this.logger.debug(`user CPU time used 'ru_utime':${data.ru_utime}`);
                }
            });
        }, this.options.resourceInterval);
    }
}

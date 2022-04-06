import * as ip from 'ip';

export class Address {
    public static getIPv4(): string {
        return ip.address();
    }
}

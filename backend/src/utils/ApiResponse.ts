export class ApiResponse {
  constructor(
    public statusCode: number,
    public data: any,
    public message: string = "Success",
  ) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
  }
}

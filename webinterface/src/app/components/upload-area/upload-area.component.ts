import {Component, EventEmitter, OnInit, Output} from '@angular/core';

@Component({
  selector: 'app-upload-area',
  templateUrl: './upload-area.component.html',
  styleUrls: ['./upload-area.component.scss']
})
export class UploadAreaComponent implements OnInit {

  @Output() file_uploaded = new EventEmitter<File>();

  constructor() { }

  ngOnInit(): void {
  }

  file_added($event: Event) {

    const uploaderElement = ($event.target as HTMLInputElement);

    if (uploaderElement === null)
      return;

    // @ts-ignore
    this.file_uploaded.emit(uploaderElement.files[0]);

  }

}

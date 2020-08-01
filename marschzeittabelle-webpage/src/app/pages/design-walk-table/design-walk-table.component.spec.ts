import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DesignWalkTableComponent } from './design-walk-table.component';

describe('DesignWalkTableComponent', () => {
  let component: DesignWalkTableComponent;
  let fixture: ComponentFixture<DesignWalkTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DesignWalkTableComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DesignWalkTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
